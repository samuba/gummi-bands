<script lang="ts">
	import { slide } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import { confirmDialog } from '$lib/components/ConfirmDialog.svelte';
	import { workout } from '$lib/stores/workout.svelte';
	import type { Exercise } from '$lib/db/app/schema';

	// Form state for adding exercises
	let newExerciseName = $state('');

	async function handleAddExercise() {
		if (!newExerciseName.trim()) return;
		await workout.addExercise(newExerciseName.trim());
		newExerciseName = '';
	}

	async function handleDeleteExercise(exercise: Exercise) {
		const confirmed = await confirmDialog.confirm({
			title: 'Delete Exercise?',
			html: `Are you sure you want to delete "<strong>${exercise.name}</strong>"?`,
			iconClass: 'icon-[ph--trash]',
			confirmText: 'Delete',
			cancelText: 'Cancel'
		});

		if (confirmed) {
			await workout.deleteExercise(exercise.id);
		}
	}
</script>

<div class="flex flex-col gap-6 animate-in fade-in">
	<Header title="Exercises" showBack />

	<div class="card flex flex-col gap-4 p-6">
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
		{#each workout.allExercises as exercise (exercise.id)}
			<div
				class="card px-5 py-2 flex items-center gap-4"
				transition:slide={{ duration: 150 }}
			>
				<i class="icon-[ph--barbell] text-xl text-text-secondary"></i>
				<div class="flex flex-1 flex-col gap-0.5">
					<span class="text-sm text-text-primary">{exercise.name}</span>
				</div>
				<button
					class="btn-ghost -mr-4"
					onclick={() => handleDeleteExercise(exercise)}
					aria-label="Delete {exercise.name}"
				>
					<i class="icon-[ph--trash] size-5"></i>
				</button>
			</div>
		{/each}
	</div>
</div>
