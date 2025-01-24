<script>
    import { onMount } from "svelte";
    import { select } from "d3-selection";
    import { zoom, zoomIdentity } from "d3-zoom";
    import {
        fetchEntities,
        fetchConnectedEntities,
        fetchSimilarEntities,
    } from "$lib/api";

    let searchQuery = "alice weidel";
    let nodes = [];
    let links = [];
    let newNodes = [];
    let newLinks = [];
    let expansions = {};

    let graphContainer;
    let linesSvgElement;
    let nodeContainerElement;

    let transform = zoomIdentity;
    let zoomBehavior;

    function radialLayout(items, cx, cy, radius, containerWidth = window.innerWidth, containerHeight = window.innerHeight) {
        if (items.length === 1) {
            items[0].x = cx;
            items[0].y = cy;
            return;
        }
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;
        const deltaX = cx - centerX;
        const deltaY = cy - centerY;
        let startAngle = 0;
        let endAngle = 2 * Math.PI;
        if (deltaX >= 0 && deltaY >= 0) {
            startAngle = Math.PI / 4;
            endAngle = (3 * Math.PI) / 4;
        } else if (deltaX < 0 && deltaY >= 0) {
            startAngle = (3 * Math.PI) / 4;
            endAngle = (5 * Math.PI) / 4;
        } else if (deltaX < 0 && deltaY < 0) {
            startAngle = (5 * Math.PI) / 4;
            endAngle = (7 * Math.PI) / 4;
        } else if (deltaX >= 0 && deltaY < 0) {
            startAngle = (7 * Math.PI) / 4;
            endAngle = Math.PI / 4;
        }
        const adjustedRadius = radius + items.length * 20;
        const angleStep = (endAngle - startAngle) / items.length;
        let angle = startAngle;
        items.forEach((item) => {
            item.x = cx + adjustedRadius * Math.cos(angle);
            item.y = cy + adjustedRadius * Math.sin(angle);
            angle += angleStep;
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
                    (x.source === l.target && x.target === l.source),
            );
            if (!found) {
                links = [...links, l];
            }
        });
    }

    async function expandNode(nodeId) {
        const centerNode = nodes.find((n) => n.id === nodeId);
        if (!centerNode) return;
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
        newNodes = [];
        newLinks = [];
        connectedData.forEach(({ property, entities }) => {
            entities.forEach((e) => {
                if (!nodes.find((x) => x.id === e.id)) {
                    const label =
                        e.properties?.name?.[0] ||
                        e.label ||
                        (e.schema && `(${e.schema})`) ||
                        "Unknown";
                    newNodes.push({ id: e.id, label, schema: e.schema || "Unknown" });
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
                    id: e.id,
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
        if (!newNodes.length) return;
        radialLayout(newNodes, centerNode.x, centerNode.y, 350, window.innerWidth, window.innerHeight);
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
                !nodesToRemove.includes(l.source) &&
                !nodesToRemove.includes(l.target),
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
            id: e.id,
            label: e.properties?.name?.[0] || e.label || "Unknown",
            schema: e.schema || "Unknown",
        }));
        radialLayout(baseNodes, centerX, centerY, 350);
        addNodesAndLinks(baseNodes, []);
    }

    function centerGraphOnNode(node) {
        const scale = transform.k;
        const translateX = window.innerWidth / 2 - node.x * scale;
        const translateY = window.innerHeight / 2 - node.y * scale;
        transform = { x: translateX, y: translateY, k: scale };
        nodeContainerElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        linesSvgElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function handleNodeClick(node) {
        if (!expansions[node.id] || expansions[node.id].length === 0) {
            expandNode(node.id);
        } else {
            collapseNode(node.id);
        }
        // centerGraphOnNode(node);
    }

    onMount(async () => {
        linesSvgElement.style.transformOrigin = "0 0";
        nodeContainerElement.style.transformOrigin = "0 0";
        zoomBehavior = zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                const { x, y, k } = event.transform;
                transform = { x, y, k };
                nodeContainerElement.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
                linesSvgElement.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
            });
        select(graphContainer).call(zoomBehavior);
        await handleSearch();
    });
</script>

<div class="search">
    <input
        type="text"
        bind:value={searchQuery}
        placeholder="Enter entity name"
    />
    <button on:click={handleSearch}>Search</button>
</div>

<div class="info">
    {#if newNodes.length === 0}
        no new links
    {/if}
</div>

<div class="graph" bind:this={graphContainer}>
    <svg class="lines-">
        <g bind:this={linesSvgElement}>
            {#each links as link}
                {@const source = nodes.find((n) => n.id === link.source)}
                {@const target = nodes.find((n) => n.id === link.target)}
                <line
                    class="link"
                    x1={source ? source.x : 0}
                    y1={source ? source.y : 0}
                    x2={target ? target.x : 0}
                    y2={target ? target.y : 0}
                    stroke-dasharray={link.type === "similar" ? "5,5" : "none"}
                />
            {/each}
        </g>
    </svg>
    <div class="nodes" bind:this={nodeContainerElement}>
        {#each nodes as node}
            <div
                class="node"
                style="
                    left: {node.x}px;
                    top: {node.y}px;
                "
                on:click={() => handleNodeClick(node)}
            >
                <div class="label">{node.label}</div>
            </div>
        {/each}
    </div>
</div>

<style>
    html, body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        width: 100%;
        height: 100%;
    }
    .search {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 1000;
    }
    .info {
        position: absolute;
        bottom: 10px;
        left: 10px;
        z-index: 1000;
        background: #f8f8f8;
        padding: 4px 8px;
        border-radius: 4px;
        color: #333;
        font-size: 12px;
    }
    .graph {
        position: absolute;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
    }
    .lines- {
        width: 100%;
        height: 100%;
        pointer-events: all;
    }
    .link {
        stroke: #889a97;
        stroke-width: 2;
    }
    .nodes {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }
    .node {
        position: absolute;
        cursor: pointer;
        pointer-events: auto;
        transform: translate(-50%, -50%);
    }

    .label {
        min-width: 60px;
        max-width: 100px;
        font-size: 10px;
        color: #8d889a;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: #eee;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 2px;
    }
</style>
