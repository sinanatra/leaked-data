<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { select } from "d3-selection";
  import { zoom, zoomIdentity } from "d3-zoom";
  import Node from "$lib/components/Node.svelte";

  export let nodes = [];
  export let links = [];
  const dispatch = createEventDispatcher();
  let graphContainer;
  let linesSvgElement;
  let nodeContainerElement;
  let transform = zoomIdentity;
  let zoomBehavior;

  onMount(() => {
    linesSvgElement.style.transformOrigin = "0 0";
    nodeContainerElement.style.transformOrigin = "0 0";
    zoomBehavior = zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        transform = event.transform;
        nodeContainerElement.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`;
        linesSvgElement.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`;
      });
    select(graphContainer).call(zoomBehavior);
  });

  function handleNodeClick(node) {
    dispatch("nodeClick", node);
  }
  function handleNodeHover(node) {
    dispatch("nodeHover", node);
  }

  function handleDragUpdate(event) {
    dispatch("dragUpdate", event.detail);
  }

  $: lineData = links.map((link) => ({
    ...link,
    source: nodes.find((n) => n.id === link.source),
    target: nodes.find((n) => n.id === link.target),
  }));

  function computeCurve(source, target) {
    const { x: x1, y: y1 } = source;
    const { x: x2, y: y2 } = target;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const offset = 30;
    const cpX = mx + offset * Math.cos(angle - Math.PI / 2);
    const cpY = my + offset * Math.sin(angle - Math.PI / 2);
    return `M ${x1} ${y1} Q ${cpX} ${cpY}, ${x2} ${y2}`;
  }
</script>

<div class="graph" bind:this={graphContainer}>
  <svg class="lines-">
    <g bind:this={linesSvgElement}>
      {#each lineData as link}
        {#if link.source && link.target}
          <line
            class="link"
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
            stroke-dasharray={link.type === "similar" ? "5,5" : "none"}
          />
        {/if}
      {/each}
    </g>
  </svg>
  <div class="nodes" bind:this={nodeContainerElement}>
    {#each nodes as node (node.id)}
      <Node
        {node}
        {transform}
        on:click={(e) => handleNodeClick(e.detail)}
        on:hover={(e) => handleNodeHover(e.detail)}
        on:dragUpdate={handleDragUpdate}
      />
    {/each}
  </div>
</div>

<style>
  .graph {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  .lines- {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .link {
    stroke: #889a97;
    stroke-width: 1;
  }
  .nodes {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>
