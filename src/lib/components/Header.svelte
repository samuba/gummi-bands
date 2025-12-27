<script lang="ts">
	interface Props {
		title?: string;
		showBack?: boolean;
		onback?: () => void;
	}

	let { title = 'Gummi Bands', showBack = false, onback }: Props = $props();
</script>

<header class="mb-6">
	<div class="flex items-center gap-4">
		{#if showBack}
			<button 
				class="flex items-center justify-center w-10 h-10 transition-all duration-200 border-none cursor-pointer bg-bg-tertiary rounded-md text-text-primary hover:bg-bg-elevated" 
				onclick={onback} 
				aria-label="Go back"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
			</button>
		{/if}
		<h1 class="text-3xl font-display tracking-wider uppercase bg-clip-text text-transparent" style="background-image: var(--gradient-fire)">
			{title}
		</h1>
	</div>
</header>
