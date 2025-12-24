<script lang="ts">
	import { onDestroy } from 'svelte';

	let elapsed = $state(0);
	let isRunning = $state(false);
	let interval: ReturnType<typeof setInterval> | undefined;

	function formatDuration(seconds: number): string {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (hrs > 0) {
			return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function startTimer() {
		if (isRunning) return;
		isRunning = true;
		interval = setInterval(() => {
			elapsed += 1;
		}, 1000);
	}

	function pauseTimer() {
		isRunning = false;
		if (interval) clearInterval(interval);
	}

	function restartTimer() {
		elapsed = 0;
	}

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

<div class="inline-flex items-center gap-4 px-4 py-2 rounded-full bg-bg-tertiary">
	<div class="flex items-center gap-2">
		{#if !isRunning}
			<button class="text-primary hover:text-white transition-colors" onclick={startTimer} aria-label="Start timer">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
					<polygon points="5 3 19 12 5 21 5 3" />
				</svg>
			</button>
		{:else}
			<button class="text-primary hover:text-white transition-colors" onclick={pauseTimer} aria-label="Pause timer">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
					<rect x="6" y="4" width="4" height="16" />
					<rect x="14" y="4" width="4" height="16" />
				</svg>
			</button>
			<button class="text-primary hover:text-white transition-colors" onclick={restartTimer} aria-label="Restart timer">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
					<path d="M21 3v5h-5" />
				</svg>
			</button>
		{/if}
	</div>

	<span class="text-xl tracking-widest font-display text-text-primary tabular-nums">
		{formatDuration(elapsed)}
	</span>
</div>
