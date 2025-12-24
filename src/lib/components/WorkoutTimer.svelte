<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		startedAt: Date;
	}

	let { startedAt }: Props = $props();

	let elapsed = $state(0);

	function updateElapsed() {
		elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
	}

	function formatDuration(seconds: number): string {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (hrs > 0) {
			return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	onMount(() => {
		updateElapsed();
		const interval = setInterval(updateElapsed, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-tertiary">
	<div class="flex text-primary">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
	</div>
	<span class="text-xl tracking-widest font-display text-text-primary">{formatDuration(elapsed)}</span>
</div>
