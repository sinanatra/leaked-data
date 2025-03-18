<script>
  import { onMount } from "svelte";
  import Graph from "$lib/components/Graph.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import {
    fetchEntities,
    fetchConnectedEntities,
    fetchSimilarEntities,
  } from "$lib/api";

  let searchQuery = "alice weidel";
  export let nodes = [];
  export let links = [];
  let expansions = {};

  let selectedNode = null;
  let hoveredNode = null;
  $: activeNode = hoveredNode || selectedNode;
  let infoMessage = "";

  function separateArcsBySchemaLayout(
    items,
    cx,
    cy,
    initialRadius = 50,
    radiusStep = 50,
    arcSpan = Math.PI
  ) {
    const groups = {};
    items.forEach((item) => {
      const key = item.schema || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const groupKeys = Object.keys(groups).sort();
    const groupCenterAngles = groupKeys.map(
      (_, i) => (Math.PI * i) / groupKeys.length
    );
    groupKeys.forEach((group, i) => {
      const groupItems = groups[group];
      const radius = initialRadius + i * radiusStep;
      const groupCenter = groupCenterAngles[i];
      const startAngle = groupCenter - arcSpan / 2;
      if (groupItems.length === 1) {
        groupItems[0].x = cx + radius * Math.cos(groupCenter);
        groupItems[0].y = cy + radius * Math.sin(groupCenter);
        groupItems[0].angle = groupCenter;
        groupItems[0].origin = { x: cx, y: cy };
      } else {
        const angleStep = arcSpan / (groupItems.length - 1);
        groupItems.forEach((item, j) => {
          const angle = startAngle + j * angleStep;
          item.x = cx + radius * Math.cos(angle);
          item.y = cy + radius * Math.sin(angle);
          item.angle = angle;
          item.origin = { x: cx, y: cy };
        });
      }
    });
  }

  function directionalArcsFromParentLayout(
    items,
    parent,
    baseRadius = 100,
    radiusStep = 100,
    arcSpan = Math.PI
  ) {
    const groups = {};
    items.forEach((item) => {
      const key = item.schema || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    const groupKeys = Object.keys(groups).sort();

    const parentAngle = parent.angle || 0;

    groupKeys.forEach((group, i) => {
      const groupItems = groups[group];
      const radius = baseRadius + i * radiusStep;
      const startAngle = parentAngle - arcSpan / 2;
      const endAngle = parentAngle + arcSpan / 2;

      if (groupItems.length === 1) {
        const angle = parentAngle;
        groupItems[0].x = parent.x + radius * Math.cos(angle);
        groupItems[0].y = parent.y + radius * Math.sin(angle);
        groupItems[0].angle = angle;
        groupItems[0].origin = { x: parent.x, y: parent.y };

        groupItems[0].relativeAngle = 0;
        groupItems[0].distance = radius;
      } else {
        const angleStep = (endAngle - startAngle) / (groupItems.length - 1);
        groupItems.forEach((item, j) => {
          const angle = startAngle + j * angleStep;
          item.x = parent.x + radius * Math.cos(angle);
          item.y = parent.y + radius * Math.sin(angle);
          item.angle = angle;
          item.origin = { x: parent.x, y: parent.y };

          item.relativeAngle = angle - parentAngle;

          item.distance = radius;
        });
      }
    });
  }

  function addNodesAndLinks(incomingNodes, incomingLinks) {
    incomingNodes.forEach((n) => {
      if (!nodes.find((x) => x.id === n.id)) {
        nodes = [...nodes, n];
      }
    });
    incomingLinks.forEach((l) => {
      const found = links.some(
        (x) =>
          (x.source === l.source && x.target === l.target) ||
          (x.source === l.target && x.target === l.source)
      );
      if (!found) {
        links = [...links, l];
      }
    });
  }

  async function expandNode(nodeId) {
    const parentNode = nodes.find((n) => n.id === nodeId);
    if (!parentNode) return;

    let connectedData = [];
    let similarData = [];
    try {
      [connectedData, similarData] = await Promise.all([
        fetchConnectedEntities(nodeId, 50),
        fetchSimilarEntities(nodeId),
      ]);
    } catch {
      return;
    }
    let newNodes = [];
    let newLinks = [];
    connectedData.forEach(({ property, entities }) => {
      entities.forEach((e) => {
        if (!nodes.find((x) => x.id === e.id)) {
          newNodes.push({
            ...e,
            label: e.properties?.name?.[0] || e.label || "Unknown",
            schema: e.schema || "Unknown",
          });
        }
        newLinks.push({
          source: nodeId,
          target: e.id,
          relation: property,
          type: "connected",
        });
      });
    });
    similarData.forEach((e) => {
      if (!nodes.find((x) => x.id === e.id)) {
        newNodes.push({
          ...e,
          label: e.label || "Unknown",
          schema: e.schema || "Unknown",
        });
      }
      newLinks.push({
        source: nodeId,
        target: e.id,
        relation: "similar",
        type: "similar",
      });
    });
    if (!newNodes.length) {
      infoMessage = "No new nodes";
      return;
    }
    infoMessage = "";
    directionalArcsFromParentLayout(newNodes, parentNode, 150, 50, Math.PI);
    addNodesAndLinks(newNodes, newLinks);
    expansions[nodeId] = newNodes.map((d) => d.id);
  }

  function collapseNode(nodeId) {
    const childIds = expansions[nodeId] || [];
    const connectedNodes = new Set();
    links.forEach((l) => {
      if (l.source !== nodeId && l.target !== nodeId) {
        connectedNodes.add(l.source);
        connectedNodes.add(l.target);
      }
    });
    const nodesToRemove = childIds.filter((id) => !connectedNodes.has(id));
    nodes = nodes.filter((n) => !nodesToRemove.includes(n.id));
    links = links.filter(
      (l) =>
        !nodesToRemove.includes(l.source) && !nodesToRemove.includes(l.target)
    );
    expansions[nodeId] = [];
  }

  function handleDragUpdate(event) {
    const updatedNode = event.detail;
    nodes = nodes.map((n) =>
      n.id === updatedNode.id ? { ...updatedNode } : n
    );
    repositionDescendants(updatedNode.id);
  }

  function repositionDescendants(parentId) {
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode || !expansions[parentId]) return;
    expansions[parentId].forEach((childId) => {
      nodes = nodes.map((child) => {
        if (child.id === childId) {
          const newAngle = (parentNode.angle || 0) + (child.relativeAngle || 0);

          const newX = parentNode.x + child.distance * Math.cos(newAngle);
          const newY = parentNode.y + child.distance * Math.sin(newAngle);
          return {
            ...child,
            x: newX,
            y: newY,
            origin: { x: parentNode.x, y: parentNode.y },
            angle: newAngle,
          };
        }
        return child;
      });
      //   repositionDescendants(childId);
    });
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    nodes = [];
    links = [];
    expansions = {};
    await fetchNode(searchQuery);
  }

  async function fetchNode(query) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const resp = await fetchEntities(query, "Person");
    if (!resp.results?.length) return;
    const baseNodes = resp.results.slice(0, 20).map((e) => ({
      ...e,
      label: e.properties?.name?.[0] || e.label || "Unknown",
      schema: e.schema || "Unknown",
    }));
    separateArcsBySchemaLayout(baseNodes, centerX, centerY);
    addNodesAndLinks(baseNodes, []);
    if (baseNodes.length > 0) {
      await expandNode(baseNodes[0].id);
    }
  }

  function handleNodeClick(node) {
    selectedNode = node;
    if (!expansions[node.id] || expansions[node.id].length === 0) {
      expandNode(node.id);
    } else {
      collapseNode(node.id);
    }
  }

  onMount(() => {
    handleSearch();
  });
</script>

<div class="app">
  <div class="header">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Enter entity name"
    />
    <button on:click={handleSearch}>Search</button>
    {#if infoMessage}
      <div class="info">{infoMessage}</div>
    {/if}
  </div>
  <Graph
    bind:nodes
    bind:links
    on:nodeClick={(e) => handleNodeClick(e.detail)}
    on:nodeHover={(e) => (hoveredNode = e.detail)}
    on:dragUpdate={handleDragUpdate}
  />
  <Sidebar {activeNode} />
</div>

<style>
  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  .header {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 2000;
  }
  .info {
    position: fixed;
    bottom: 10px;
    left: 10px;
    z-index: 1000;
    background: #f8f8f8;
    padding: 4px 8px;
    border-radius: 4px;
    color: #333;
    font-size: 12px;
  }
</style>
