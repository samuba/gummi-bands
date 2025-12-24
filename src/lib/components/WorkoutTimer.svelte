<script lang="ts">
	let elapsed = $state(0);
	let isRunning = $state(false);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	function start() {
		if (isRunning) return;
		isRunning = true;
		intervalId = setInterval(() => {
			elapsed += 1;
		}, 1000);
	}

	function pause() {
		isRunning = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function reset() {
		pause();
		elapsed = 0;
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

	$effect(() => {
		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	});
</script>

<div class="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-bg-tertiary">
	<!-- Timer icon -->
	<div class="flex text-primary">
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
	</div>

	<!-- Time display -->
	<span class="text-lg tracking-widest font-display text-text-primary min-w-18">{formatDuration(elapsed)}</span>

	<!-- Controls -->
	<div class="flex items-center gap-1">
		{#if !isRunning}
			<!-- Play button -->
			<button
				onclick={start}
				class="flex items-center justify-center w-8 h-8 rounded-full bg-primary hover:bg-primary-dark transition-colors cursor-pointer"
				aria-label="Start timer"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-white ml-0.5">
					<polygon points="5 3 19 12 5 21 5 3" />
				</svg>
			</button>
		{:else}
			<!-- Pause button -->
			<button
				onclick={pause}
				class="flex items-center justify-center w-8 h-8 rounded-full bg-accent hover:brightness-110 transition-all cursor-pointer"
				aria-label="Pause timer"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-bg-primary">
					<rect x="6" y="4" width="4" height="16" />
					<rect x="14" y="4" width="4" height="16" />
				</svg>
			</button>
		{/if}

		{#if isRunning || elapsed > 0}
			<!-- Reset button -->
			<button
				onclick={reset}
				class="flex items-center justify-center w-8 h-8 rounded-full bg-bg-elevated hover:bg-error/20 hover:text-error transition-colors cursor-pointer text-text-secondary"
				aria-label="Reset timer"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
					<path d="M3 3v5h5" />
				</svg>
			</button>
		{/if}
	</div>
</div>
