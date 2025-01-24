<main>
    <slot />
</main>

<style>
    :global(html, body) {
        margin: 0;
        padding: 0;
        overflow: hidden;
        height: 100%;
        width: 100%;
    }
    
    main {
        /* -webkit-font-smoothing: none; */
        text-rendering: optimizeLegibility;
        font-family: Helvetica, Arial, sans-serif;
        hyphens: auto;
    }
</style>
