<script lang="ts">
	// THIS COMPONENT IS ONLY FOR DEBUGGING IN DEV
	import { onMount } from 'svelte';
	import { browser, dev } from '$app/environment';

	onMount(async () => {
		// if (!dev) return;

		await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite-repl/dist-webcomponent/Repl.js' as any);
		const db = await import('$lib/db/client');
		await db.initDatabase();
		(document.getElementById('pglite-repl') as any).pg = db.pglite;
	});
</script>

{#if browser}
    <pglite-repl id="pglite-repl"></pglite-repl>
{/if}