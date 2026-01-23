<script lang="ts" module>
	import type { Exercise } from '$lib/db/schema';

	export type EditTemplateOptions = {
		id: string;
		name: string;
		exercises: Exercise[];
	};

	export type EditTemplateResult = {
		action: 'save' | 'delete';
		name: string;
		exercises: Exercise[];
	} | null;

	export type EditTemplateContext = {
		open: (options: EditTemplateOptions) => Promise<EditTemplateResult>;
	};

	export const editTemplateDialog: EditTemplateContext = {
		open: null!
	};
</script>

<script lang="ts">
	import { Dialog } from './dialog';
	import { Select } from 'bits-ui';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { confirmDialog } from './ConfirmDialog.svelte';
	import { workout } from '$lib/stores/workout.svelte';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';

	const open = $derived(page.state.editTemplateOpen === true);
	let templateId = $state('');
	let templateName = $state('');
	let originalName = $state('');
	let selectedExercises = $state<Exercise[]>([]);
	let pendingOptions = $state<EditTemplateOptions | null>(null);


	let resolvePromise: ((value: EditTemplateResult) => void) | null = null;

	// Load data when dialog opens
	$effect(() => {
		if (open && pendingOptions) {
			templateId = pendingOptions.id;
			templateName = pendingOptions.name;
			originalName = pendingOptions.name;
			selectedExercises = [...pendingOptions.exercises];
			pendingOptions = null;
		}
	});

	function openDialog(options: EditTemplateOptions) {
		pendingOptions = options;
		pushState('', { ...page.state, editTemplateOpen: true });

		return new Promise<EditTemplateResult>((resolve) => {
			resolvePromise = resolve;
		});
	}

	function handleSave() {
		resolvePromise?.({
			action: 'save',
			name: templateName.trim(),
			exercises: selectedExercises
		});
		resolvePromise = null;
		handleOpenChange(false);
	}

	async function handleDelete() {
		const confirmed = await confirmDialog.confirm({
			title: 'Delete Template?',
			html: `Are you sure you want to delete "<strong>${originalName}</strong>"?`,
			iconClass: 'icon-[ph--trash]',
			confirmText: 'Delete',
			cancelText: 'Cancel'
		});

		if (confirmed) {
			resolvePromise?.({
				action: 'delete',
				name: templateName.trim(),
				exercises: selectedExercises
			});
			resolvePromise = null;
			handleOpenChange(false);
		}
	}

	function handleCancel() {
		resolvePromise?.(null);
		resolvePromise = null;
		handleOpenChange(false);
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen) {
			pushState('', { ...page.state, editTemplateOpen: true });
		} else {
			if (page.state.editTemplateOpen) {
				history.back();
			}
		}
	}

	function addExercise(exerciseId: string) {
		const exercise = workout.allExercises.find((e) => e.id === exerciseId);
		if (exercise && !selectedExercises.some((e) => e.id === exerciseId)) {
			selectedExercises = [...selectedExercises, exercise];
		}
	}

	function removeExerciseAtIndex(index: number) {
		selectedExercises = selectedExercises.filter((_, i) => i !== index);
	}

	function moveExerciseUp(index: number) {
		if (index === 0) return;
		const newExercises = [...selectedExercises];
		[newExercises[index - 1], newExercises[index]] = [
			newExercises[index],
			newExercises[index - 1]
		];
		selectedExercises = newExercises;
	}

	function moveExerciseDown(index: number) {
		if (index === selectedExercises.length - 1) return;
		const newExercises = [...selectedExercises];
		[newExercises[index], newExercises[index + 1]] = [
			newExercises[index + 1],
			newExercises[index]
		];
		selectedExercises = newExercises;
	}

	editTemplateDialog.open = openDialog;

	const isValid = $derived(templateName.trim().length > 0);
	const availableExercises = $derived(
		workout.allExercises.filter((e) => !selectedExercises.some((se) => se.id === e.id))
	);
</script>

<Dialog.Root open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) handleCancel(); }}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="max-w-md flex flex-col" interactOutsideBehavior="ignore">
			<Dialog.Title class="text-lg font-semibold tracking-wide text-text-primary font-display shrink-0">
				Edit Template
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-sm text-text-muted shrink-0">
				Update the template's name and exercises.
			</Dialog.Description>

			<div class="mt-5 flex flex-col gap-4 min-h-0 overflow-y-auto flex-1">
				<div class="flex flex-col gap-1">
					<label class="text-xs tracking-wide text-text-muted uppercase" for="edit-template-name">
						Name
					</label>
					<input
						id="edit-template-name"
						type="text"
						placeholder="Template name"
						bind:value={templateName}
						class="w-full px-4 py-3 text-sm transition-colors duration-200 border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
					/>
				</div>

				<div class="flex flex-col gap-3">
					<span class="text-sm font-medium text-text-secondary">Exercises</span>

					<div class="flex flex-col gap-2">
						<!-- Selected exercises list -->
						{#if selectedExercises.length > 0}
							<div class="flex flex-col gap-2">
								{#each selectedExercises as exercise, index (exercise.id)}
									<div
										class="flex items-center gap-2 rounded-md border border-bg-elevated bg-bg-secondary px-3 py-2"
										animate:flip={{ duration: 200 }}
										in:fade={{ duration: 150 }}
										out:fade={{ duration: 100 }}
									>
										<div class="flex flex-col gap-0.5">
											<button
												type="button"
												class="flex items-center justify-center rounded bg-bg-tertiary p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
												onclick={() => moveExerciseUp(index)}
												disabled={index === 0}
												aria-label="Move {exercise.name} up"
											>
												<i class="icon-[ph--caret-up] size-5"></i>
											</button>
											<button
												type="button"
												class="flex items-center justify-center rounded bg-bg-tertiary p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
												onclick={() => moveExerciseDown(index)}
												disabled={index === selectedExercises.length - 1}
												aria-label="Move {exercise.name} down"
											>
												<i class="icon-[ph--caret-down] size-5"></i>
											</button>
										</div>
										<span class="flex-1 text-sm font-medium text-text-primary">{exercise.name}</span>
										<button
											type="button"
											class="flex items-center justify-center rounded bg-bg-tertiary p-1.5 text-text-secondary hover:bg-error/10 hover:text-error transition-colors"
											onclick={() => removeExerciseAtIndex(index)}
											aria-label="Remove {exercise.name}"
										>
											<i class="icon-[ph--x] size-5"></i>
										</button>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Add exercise select -->
						{#if availableExercises.length > 0}
							<Select.Root
								type="single"
								onValueChange={(v) => addExercise(v)}
								items={availableExercises.map((e) => ({ value: e.id, label: e.name }))}
							>
								<Select.Trigger
									class="flex items-center gap-1.5 rounded-full border-2 border-dashed border-bg-elevated bg-bg-tertiary px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-primary hover:text-text-secondary focus:border-primary focus:outline-none"
								>
									<svg
										class="h-3.5 w-3.5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
									<span>Add exercise</span>
								</Select.Trigger>
								<Select.Portal>
									<Select.Content
										class="z-100 max-h-60 overflow-y-auto rounded-lg border border-bg-elevated bg-bg-secondary p-1 shadow-xl"
										sideOffset={4}
									>
										<Select.Viewport>
											{#each availableExercises as exercise (exercise.id)}
												<Select.Item
													class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary outline-none data-highlighted:bg-bg-tertiary"
													value={exercise.id}
													label={exercise.name}
												>
													<span class="flex-1">{exercise.name}</span>
												</Select.Item>
											{/each}
										</Select.Viewport>
									</Select.Content>
								</Select.Portal>
							</Select.Root>
						{:else}
							<p class="text-sm text-text-muted">All exercises added</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex gap-3 mt-6 shrink-0">
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 border rounded-lg cursor-pointer bg-bg-tertiary border-bg-elevated text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
					onclick={handleCancel}
				>
					Cancel
				</button>
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg cursor-pointer bg-primary hover:bg-primary/80 text-white disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleSave}
					disabled={!isValid}
				>
					Save
				</button>
			</div>

			<button
				class="flex items-center justify-center gap-2 w-full mt-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg cursor-pointer text-error hover:bg-error/10 shrink-0"
				onclick={handleDelete}
			>
				<i class="icon-[ph--trash] size-4"></i>
				Delete Template
			</button>

			<Dialog.Close
				class="absolute p-1 transition-colors rounded-md top-4 right-4 text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
			>
				<i class="icon-[ph--x] size-5"></i>
				<span class="sr-only">Close</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
