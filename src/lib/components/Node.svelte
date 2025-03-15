<script>
  import { createEventDispatcher } from "svelte";
  import { drag } from "d3-drag";
  import { select } from "d3-selection";

  export let node;
  export let transform;
  const dispatch = createEventDispatcher();
  let nodeDiv;

  function draggable(el) {
    const dragBehavior = drag()
      .clickDistance(5)
      .on("start", (event) => {
        event.sourceEvent.stopPropagation();
      })
      .on("drag", (event) => {
        const t = transform || { k: 1 };
        node.x += event.dx / t.k;
        node.y += event.dy / t.k;
        node.angle = Math.atan2(node.y - node.origin.y, node.x - node.origin.x);
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;

        dispatch("dragUpdate", { ...node });
      });
    select(el).call(dragBehavior);
    return {
      destroy() {
        select(el).on(".drag", null);
      },
    };
  }
</script>

<div
  bind:this={nodeDiv}
  class="node"
  style="left: {node.x}px; top: {node.y}px;"
  use:draggable
  on:click|stopPropagation={() => dispatch("click", node)}
  on:mouseover={() => dispatch("hover", node)}
  on:mouseout={() => dispatch("hover", null)}
>
  <div
    class="label"
    style="background: {node.schema === 'Person'
      ? '#8d889a'
      : '#007BFF'}; transform: rotate({(node.angle * 180) /
      Math.PI}deg); transform-origin: center;"
  >
    {node.label}
  </div>
</div>

<style>
  .node {
    position: absolute;
    cursor: pointer;
    pointer-events: auto;
    transform: translate(-50%, -50%);
    user-select: none;
    z-index: 1;
  }
  .node:hover {
    z-index: 1000;
  }
  .label {
    min-width: 60px;
    max-width: 100px;
    font-size: 10px;
    color: #222;
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
