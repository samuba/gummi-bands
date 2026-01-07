<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import * as workout from '$lib/stores/workout.svelte';

	let workoutState = workout.getState();

	async function setWeightUnit(unit: 'lbs' | 'kg') {
		await workout.updateWeightUnit(unit);
	}
</script>

<div class="flex flex-col gap-6 animate-fade-in">
	<Header title="Settings" showBack />

	<div class="flex flex-col gap-4">
		<div class="card flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<h3 class="text-lg font-medium text-text-primary">Weight Units</h3>
				<p class="text-sm text-text-muted">Choose your preferred weight unit for all displays.</p>
			</div>

			<div class="flex gap-2 p-1 bg-bg-tertiary rounded-lg">
				<button
					class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 {workoutState.weightUnit === 'lbs' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}"
					onclick={() => setWeightUnit('lbs')}
				>
					Pounds (lbs)
				</button>
				<button
					class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 {workoutState.weightUnit === 'kg' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}"
					onclick={() => setWeightUnit('kg')}
				>
					Kilograms (kg)
				</button>
			</div>
		</div>

		<div class="card flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<h3 class="text-lg font-medium text-text-primary">About</h3>
				<p class="text-sm text-text-muted">Gummi Bands v1.0.0</p>
			</div>
			<div class="text-xs text-text-muted italic">
				Keep pushing your limits.
			</div>
		</div>
	</div>
</div>

