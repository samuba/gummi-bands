<script lang="ts">
	import * as workout from '$lib/stores/workout.svelte';
	import { settings } from '$lib/stores/settings.svelte';

	let workoutState = workout.getState();
	let stats = $derived(workoutState.stats);
</script>

<div class="card flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium tracking-wide text-text-secondary uppercase">Workout Stats</h3>
		<span class="text-[0.65rem] text-text-muted uppercase">This Week: {settings.formatNumber(stats.thisWeekSessions, 0)}</span>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<!-- Total Volume -->
		<div class="flex flex-col gap-2 rounded-lg bg-bg-tertiary/50 p-3 border border-bg-tertiary">
			<div class="flex items-center gap-2 text-text-muted">
				<i class="icon-[ph--armchair-fill] text-primary size-4"></i>
				<span class="text-[0.65rem] font-bold tracking-wider uppercase">Volume</span>
			</div>
			<div class="flex flex-col">
				<span class="font-display text-2xl text-text-primary">
					{settings.formatNumber(settings.toUserWeight(stats.totalVolume))}
				</span>
				<span class="text-[0.65rem] text-text-muted uppercase">
					{settings.weightUnit} moved
				</span>
			</div>
		</div>

		<!-- Total Reps -->
		<div class="flex flex-col gap-2 rounded-lg bg-bg-tertiary/50 p-3 border border-bg-tertiary">
			<div class="flex items-center gap-2 text-text-muted">
				<i class="icon-[ph--repeat-fill] text-secondary size-4"></i>
				<span class="text-[0.65rem] font-bold tracking-wider uppercase">Reps</span>
			</div>
			<div class="flex flex-col">
				<span class="font-display text-2xl text-text-primary">{settings.formatNumber(stats.totalReps, 0)}</span>
				<span class="text-[0.65rem] text-text-muted uppercase">Total reps</span>
			</div>
		</div>

		<!-- Top Exercise -->
		<div class="col-span-2 flex items-center justify-between rounded-lg bg-bg-tertiary/50 p-3 border border-bg-tertiary">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
					<i class="icon-[ph--crown-fill] size-6"></i>
				</div>
				<div class="flex flex-col">
					<span class="text-[0.65rem] font-bold tracking-wider text-text-muted uppercase">Top Exercise</span>
					<span class="font-display text-sm text-text-primary uppercase truncate max-w-[180px]">
						{stats.topExercise}
					</span>
				</div>
			</div>
			<div class="flex flex-col items-end">
				<span class="font-display text-xl text-primary">{settings.formatNumber(stats.totalSessions, 0)}</span>
				<span class="text-[0.65rem] text-text-muted uppercase">Total Workouts</span>
			</div>
		</div>
	</div>
</div>

