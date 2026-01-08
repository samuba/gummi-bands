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
	<div class="flex text-text-secondary">
		<i class="icon-[ph--timer] size-5"></i>
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
				<i class="icon-[ph--play-fill] size-[14px] text-white"></i>
			</button>
		{:else}
			<!-- Pause button -->
			<button
				onclick={pause}
				class="flex items-center justify-center w-8 h-8 rounded-full bg-accent hover:brightness-110 transition-all cursor-pointer"
				aria-label="Pause timer"
			>
				<i class="icon-[ph--pause-fill] size-[14px] text-bg-primary"></i>
			</button>
		{/if}

		{#if isRunning || elapsed > 0}
			<!-- Reset button -->
			<button
				onclick={reset}
				class="flex items-center justify-center w-8 h-8 rounded-full bg-bg-elevated hover:bg-error/20 hover:text-error transition-colors cursor-pointer text-text-secondary"
				aria-label="Reset timer"
			>
				<i class="icon-[ph--arrow-counter-clockwise] size-[14px]"></i>
			</button>
		{/if}
	</div>
</div>
