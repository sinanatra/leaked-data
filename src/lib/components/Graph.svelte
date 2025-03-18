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

  function computeMidpoint(source, target) {
    return {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2,
    };
  }

  function computeLabelAngle(source, target) {
    return (
      (Math.atan2(target.y - source.y, target.x - source.x) * 180) / Math.PI
    );
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
          {#if link.relation}
            {#key link.source.id + "-" + link.target.id}
              <text
                class="relation-label"
                style="fill: white; stroke-weight: 10px; stroke:white"
                text-anchor="middle"
                alignment-baseline="middle"
                x={computeMidpoint(link.source, link.target).x}
                y={computeMidpoint(link.source, link.target).y}
                transform={`rotate(${computeLabelAngle(link.source, link.target)}, ${computeMidpoint(link.source, link.target).x}, ${computeMidpoint(link.source, link.target).y})`}
              >
                {link.relation}
              </text>
              <text
                class="relation-label"
                text-anchor="middle"
                alignment-baseline="middle"
                x={computeMidpoint(link.source, link.target).x}
                y={computeMidpoint(link.source, link.target).y}
                transform={`rotate(${computeLabelAngle(link.source, link.target)}, ${computeMidpoint(link.source, link.target).x}, ${computeMidpoint(link.source, link.target).y})`}
              >
                {link.relation}
              </text>
            {/key}
          {/if}
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
  .relation-label {
    font-size: 8px;
    fill: #333;
    pointer-events: none;
  }
  .nodes {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>
