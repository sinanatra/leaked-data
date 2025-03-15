<script>
  import ObjectViewer from "$lib/components/ObjectViewer.svelte";
  export let data;
</script>

{#if typeof data === "object" && data !== null}
  <ul>
    {#each Object.entries(data) as [key, value]}
      <li>
        <strong>{key}:</strong>
        {#if typeof value === "object" && value !== null}
          <ObjectViewer data={value} />
        {:else}
          {value}
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <span>{data}</span>
{/if}

<style>
  ul {
    list-style: none;
    padding-left: 1em;
    margin: 0;
  }
  li {
    margin: 0.2em 0;
  }
  strong {
    color: #333;
  }
</style>
