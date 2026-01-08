<script lang="ts">
	import * as pwa from '$lib/stores/pwa.svelte';

	interface Props {
		title?: string;
		showBack?: boolean;
		backHref?: string;
	}

	let { title = 'Gummi Bands', showBack = false, backHref = '/' }: Props = $props();

	const pwaState = pwa.getPwaState();
</script>

<header class="mb-6">
	<div class="flex items-center gap-4">
		{#if showBack}
			<a 
				href={backHref}
				class="flex items-center justify-center w-10 h-10 transition-all duration-200 border-none cursor-pointer bg-bg-tertiary rounded-md text-text-primary hover:bg-bg-elevated" 
				aria-label="Go back"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
			</a>
		{/if}
		<h1 class="text-3xl font-display tracking-wider uppercase bg-clip-text text-transparent" style="background-image: var(--gradient-fire)">
			{title}
		</h1>

		{#if pwaState.deferredPrompt}
			<button 
				class="ml-auto flex items-center justify-center gap-2 px-4 py-2 transition-all duration-200 border-none cursor-pointer bg-bg-tertiary rounded-md text-text-primary hover:bg-bg-elevated animate-fade-in font-display tracking-wider uppercase text-sm"
				onclick={pwa.installPwa}
			>
				<i class="icon-[ph--download-simple] size-5"></i>
				Install App
			</button>
		{/if}
	</div>
</header>
