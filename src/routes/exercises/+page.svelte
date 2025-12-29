<script lang="ts">
	import { slide } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import { getContext } from 'svelte';
	import type { Exercise } from '$lib/db/schema';

	let workoutState = workout.getState();

	// Form state for adding exercises
	let newExerciseName = $state('');

	// Get delete handlers from layout context
	const { requestDeleteExercise } = getContext<{
		requestDeleteExercise: (exercise: Exercise) => void;
	}>('deleteHandlers');

	async function handleAddExercise() {
		if (!newExerciseName.trim()) return;
		await workout.addExercise(newExerciseName.trim());
		newExerciseName = '';
	}
</script>

<div class="flex flex-col gap-6 animate-fade-in">
	<Header title="Exercises" showBack />

	<div class="card flex flex-col gap-4">
		<h3 class="text-base font-medium text-text-secondary">Add New Exercise</h3>
		<div class="flex gap-4">
			<input
				type="text"
				placeholder="Exercise name (e.g., Bicep Curls)"
				bind:value={newExerciseName}
			/>
		</div>
		<button class="btn-primary" onclick={handleAddExercise} disabled={!newExerciseName.trim()}>
			Add Exercise
		</button>
	</div>

	<div class="flex flex-col gap-2">
		{#each workoutState.exercises as exercise (exercise.id)}
			<div
				class="flex items-center gap-4 rounded-md border border-bg-tertiary bg-bg-secondary p-4"
				transition:slide={{ duration: 150 }}
			>
				<i class="icon-[ph--barbell] text-xl text-text-secondary"></i>
				<div class="flex flex-1 flex-col gap-0.5">
					<span class="text-sm text-text-primary">{exercise.name}</span>
				</div>
				<button
					class="btn-ghost"
					onclick={() => requestDeleteExercise(exercise)}
					aria-label="Delete {exercise.name}"
				>
					<i class="icon-[ph--trash] size-5"></i>
				</button>
			</div>
		{/each}
	</div>
</div>

