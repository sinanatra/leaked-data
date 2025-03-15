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
    initialRadius,
    radiusStep,
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
      (_, i) => (2 * Math.PI * i) / groupKeys.length
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
    baseRadius,
    radiusStep,
    arcSpan = (3 * Math.PI) / 2
  ) {
    const groups = {};
    items.forEach((item) => {
      const key = item.schema || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const groupKeys = Object.keys(groups).sort();
    const centerAngle = parent.angle || 0;
    const startAngle = centerAngle - arcSpan / 2;
    groupKeys.forEach((group, i) => {
      const groupItems = groups[group];
      const radius = baseRadius + i * radiusStep;
      if (groupItems.length === 1) {
        groupItems[0].x = parent.x + radius * Math.cos(centerAngle);
        groupItems[0].y = parent.y + radius * Math.sin(centerAngle);
        groupItems[0].angle = centerAngle;
        groupItems[0].origin = { x: parent.x, y: parent.y };
      } else {
        const angleStep = arcSpan / (groupItems.length - 1);
        groupItems.forEach((item, j) => {
          const angle = startAngle + j * angleStep;
          item.x = parent.x + radius * Math.cos(angle);
          item.y = parent.y + radius * Math.sin(angle);
          item.angle = angle;
          item.origin = { x: parent.x, y: parent.y };
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
    } else {
      infoMessage = "";
    }
    directionalArcsFromParentLayout(newNodes, parentNode, 250, 120);
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
    separateArcsBySchemaLayout(baseNodes, centerX, centerY, 50, 200);
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
    margin-top: 10px;
    padding: 5px;
    background: #f8f8f8;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>
