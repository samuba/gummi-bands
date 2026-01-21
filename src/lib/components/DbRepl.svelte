<script module lang="ts">
	import { browser } from '$app/environment';
	class DbReplStore {
		enabled = $state(false);
		clickCount = $state(0);
		lastClickTime = $state(0);
		clicksNeeded = 7;

		constructor() {
			if (browser) {
				const stored = localStorage.getItem('dbRepl-enabled');
				this.enabled = stored === 'true';
			}
		}

		registerClick() {
			const now = Date.now();
			// Reset counter if more than 2 seconds passed since last click
			if (now - this.lastClickTime > 2000) {
				this.clickCount = 0;
			}

			this.clickCount++;
			this.lastClickTime = now;
			
			if (this.clickCount >= this.clicksNeeded) {
				if (this.enabled) {
					this.disable();
				} else {
					this.enable();
				}
			} else {
				console.log(this.clicksNeeded - this.clickCount + " clicks more needed");
			}
		}

		enable() {
			this.enabled = true;
			localStorage.setItem('dbRepl-enabled', 'true');
			alert('😎 DB Repl enabled on all screens');
		}

		disable() {
			this.enabled = false;
			this.clickCount = 0;
			localStorage.removeItem('dbRepl-enabled');
			alert('🥷🏻 DB Repl disabled');
		}
	}

	export const dbRepl = new DbReplStore();
</script>
<script lang="ts">
	// THIS COMPONENT IS ONLY FOR DEBUGGING

	$effect(() => { 
		if (!dbRepl.enabled) return;
		init()
	});

	async function init() {
		await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite-repl/dist-webcomponent/Repl.js' as any);
		const db = await import('$lib/db/client');
		await db.initDatabase();
		(document.getElementById('pglite-repl') as any).pg = db.pglite;
	}	
</script>

{#if browser && dbRepl.enabled}
    <pglite-repl id="pglite-repl"></pglite-repl>
{/if}