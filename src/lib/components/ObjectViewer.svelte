<script>
  import ObjectViewer from "$lib/components/ObjectViewer.svelte";
  export let data;

  $: displayData =
    typeof data === "object" && data !== null
      ? data.properties || data.links
        ? {
            ...(data.properties || {}),
            ...(data.links ? { links: data.links } : {}),
          }
        : data
      : data;
</script>

{#if typeof displayData === "object" && displayData !== null}
  <ul>
    {#each Object.entries(displayData) as [key, value]}
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
  <span>{displayData}</span>
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
