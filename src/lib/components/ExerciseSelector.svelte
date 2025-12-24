<script lang="ts">
	import type { Exercise } from '$lib/db/schema';

	interface Props {
		exercises: Exercise[];
		selectedId: string | null;
		onchange: (id: string | null) => void;
	}

	let { exercises, selectedId, onchange }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<label class="text-sm font-medium text-text-secondary" for="exercise-select">Exercise</label>
	<select 
		id="exercise-select"
		value={selectedId || ''}
		class="w-full p-4 text-base transition-colors duration-200 border-2 rounded-md appearance-none bg-bg-tertiary border-bg-elevated text-text-primary focus:outline-none focus:border-primary"
		style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23B3B3B3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 12px center; background-size: 16px; padding-right: 44px;"
		onchange={(e) => onchange(e.currentTarget.value || null)}
	>
		<option value="">Select an exercise...</option>
		{#each exercises as exercise (exercise.id)}
			<option value={exercise.id}>{exercise.name}</option>
		{/each}
	</select>
</div>
