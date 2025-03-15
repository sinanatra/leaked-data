<script>
  import ObjectViewer from "$lib/components/ObjectViewer.svelte";
  export let activeNode;
</script>

<div class="sidebar">
  {#if activeNode}
    <h2>{activeNode.label}</h2>
    <ObjectViewer data={activeNode} />
  {:else}
    <p>Hover or click on a node to see details.</p>
  {/if}
</div>

<style>
  .sidebar {
    width: 250px;
    background: #fff;
    border-left: 1px solid #ccc;
    padding: 1em;
    overflow-y: auto;
    font-size: 0.9em;
  }
  .sidebar h2 {
    margin-top: 0;
  }
</style>
