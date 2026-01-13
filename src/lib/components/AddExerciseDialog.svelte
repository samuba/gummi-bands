<script lang="ts">
	import { Dialog }from './dialog';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import type { Exercise } from '$lib/db/schema';

	interface Props {
		exercises: Exercise[];
		excludeIds?: string[];
		onselect: (exercise: Exercise) => void;
	}

	let { exercises, excludeIds = [], onselect }: Props = $props();

	const open = $derived(page.state.addExerciseOpen === true);
	let searchQuery = $state('');

	const filteredExercises = $derived(
		exercises
			.filter((e) => !excludeIds.includes(e.id))
			.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	function handleOpenChange(isOpen: boolean) {
		if (isOpen) {
			pushState('', { ...page.state, addExerciseOpen: true });
		} else {
			if (page.state.addExerciseOpen) {
				history.back();
			}
		}
	}

	function handleSelect(exercise: Exercise) {
		onselect(exercise);
		handleOpenChange(false);
		searchQuery = '';
	}
</script>

<Dialog.Root open={open} onOpenChange={handleOpenChange}>
	<Dialog.Trigger
		class="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-2 border-dashed rounded-lg cursor-pointer text-text-secondary border-bg-elevated hover:border-primary hover:text-primary hover:bg-bg-tertiary"
	>
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
		Add Exercise
	</Dialog.Trigger>

	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content interactOutsideBehavior="ignore">
			<Dialog.Title class="text-lg font-semibold tracking-wide text-text-primary font-display">
				Add Exercise
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-sm text-text-muted">
				Select an exercise to add to your workout.
			</Dialog.Description>

			<div class="mt-4">
				<input
					type="text"
					placeholder="Search exercises..."
					bind:value={searchQuery}
					class="w-full px-4 py-3 text-sm transition-colors duration-200 border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
				/>
			</div>

			<div class="flex flex-col gap-2 mt-4 overflow-y-auto max-h-64">
				{#if filteredExercises.length === 0}
					<p class="py-4 text-sm text-center text-text-muted">No exercises available</p>
				{:else}
					{#each filteredExercises as exercise (exercise.id)}
						<button
							class="flex items-center gap-3 p-3 text-left transition-all duration-150 rounded-lg cursor-pointer bg-bg-tertiary hover:bg-bg-elevated hover:text-primary"
							onclick={() => handleSelect(exercise)}
						>
							<i class="icon-[ph--barbell] text-lg text-text-secondary"></i>
							<span class="text-sm font-medium text-text-primary">{exercise.name}</span>
						</button>
					{/each}
				{/if}
			</div>

			<Dialog.Close
				class="absolute p-1 transition-colors rounded-md top-4 right-4 text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
			>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
				<span class="sr-only">Close</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

