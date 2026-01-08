<script lang="ts">
	import { Dialog } from './dialog';
	import { Select } from 'bits-ui';
	import { fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import type { Band, Exercise } from '$lib/db/schema';
	import * as workout from '$lib/stores/workout.svelte';

	interface Props {
		exercise: Exercise;
		bands: Band[];
		currentLog?: {
			fullReps: number;
			partialReps: number;
			bands: Band[];
			notes?: string | null;
		};
		onlog: (bandIds: string[], fullReps: number, partialReps: number, notes?: string) => void;
	}

	let { exercise, bands, currentLog, onlog }: Props = $props();

	const open = $derived(page.state.logExerciseId === exercise.id);

	let selectedBandIds = $state<string[]>([]);
	let fullReps = $state<number | null>(0);
	let partialReps = $state<number | null>(0);
	let notes = $state('');
	let previousData = $state<workout.PreviousExerciseData>(null);

	// Selected bands with full data and index for removal
	const selectedBandsWithIndex = $derived(
		selectedBandIds
			.map((id, index) => ({ band: bands.find((b) => b.id === id), index }))
			.filter((item): item is { band: Band; index: number } => item.band !== undefined)
	);

	// Load previous data when dialog opens
	$effect(() => {
		if (open) {
			loadData();
		}
	});

	async function loadData() {
		// If we have current log data, use that
		if (currentLog) {
			selectedBandIds = currentLog.bands.map((b) => b.id);
			fullReps = currentLog.fullReps;
			partialReps = currentLog.partialReps;
			notes = currentLog.notes || '';
		} else {
			// Otherwise load previous exercise data
			previousData = await workout.getPreviousExerciseData(exercise.id);

			// Auto-fill with previous bands
			if (previousData) {
				selectedBandIds = previousData.bandIds.filter((id) => bands.some((b) => b.id === id));
			} else {
				selectedBandIds = [];
			}
			fullReps = 0;
			partialReps = 0;
			notes = '';
		}
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen) {
			pushState('', { ...page.state, logExerciseId: exercise.id });
		} else {
			if (page.state.logExerciseId === exercise.id) {
				history.back();
			}
		}
	}

	function addBand(bandId: string) {
		if (bandId) {
			selectedBandIds = [...selectedBandIds, bandId];
		}
	}

	function removeBandAtIndex(index: number) {
		selectedBandIds = selectedBandIds.filter((_, i) => i !== index);
	}

	function handleSave() {
		onlog(selectedBandIds, fullReps || 0, partialReps || 0, notes.trim() || undefined);
		handleOpenChange(false);
	}

	function getTotalResistance(): number {
		return selectedBandIds.reduce((sum, id) => {
			const band = bands.find((b) => b.id === id);
			return sum + (band?.resistance || 0);
		}, 0);
	}

	const canSave = $derived(
		selectedBandIds.length > 0 && ((fullReps || 0) > 0 || (partialReps || 0) > 0)
	);
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Trigger class="w-full text-left">
		<div
			class="flex cursor-pointer items-start justify-between border-b border-bg-tertiary p-4 transition-all duration-150 hover:bg-bg-tertiary"
		>
			<div class="flex flex-col gap-1">
				<span class="font-semibold text-text-primary">{exercise.name}</span>
				{#if currentLog && currentLog.bands.length > 0}
					<span class="text-sm text-text-muted">
						{currentLog.bands.map((b) => b.name).join(', ')}
					</span>
				{:else}
					<span class="text-sm text-text-muted italic">Tap to log</span>
				{/if}
			</div>
			{#if currentLog}
				<div class="flex flex-col items-end gap-0.5">
					<span class="text-lg font-bold text-text-primary">{currentLog.fullReps}</span>
					{#if currentLog.partialReps > 0}
						<span class="text-sm text-text-muted">+{currentLog.partialReps}</span>
					{/if}
				</div>
			{/if}
		</div>
	</Dialog.Trigger>

	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="max-h-[90vh] overflow-y-auto">
			<Dialog.Title class="font-display text-xl font-semibold tracking-wide text-text-primary">
				{exercise.name}
			</Dialog.Title>

			<!-- Band Selection -->
			<div class="mt-6 flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-text-secondary">Bands</span>
					{#if selectedBandIds.length > 0}
						<span class="text-sm text-primary">{workout.formatWeight(getTotalResistance())}</span>
					{/if}
				</div>

				<div class="flex flex-wrap gap-2">
					<!-- Selected bands list -->
					{#each selectedBandsWithIndex as { band, index } (index)}
						<button
							type="button"
							class="group flex cursor-pointer items-center gap-2 rounded-full border border-bg-elevated bg-bg-tertiary px-3 py-1.5 text-left hover:bg-bg-elevated"
							onclick={() => removeBandAtIndex(index)}
							animate:flip={{ duration: 200 }}
							in:fade={{ duration: 150 }}
							out:fade={{ duration: 100 }}
						>
							<span
								class="h-2.5 w-2.5 shrink-0 rounded-full"
								style:background-color={band.color || '#666'}
								style:box-shadow={`0 0 6px ${band.color || '#666'}`}
							></span>
							<span class="text-sm font-medium text-text-primary">{band.name}</span>
							<span class="text-xs text-text-muted">{workout.formatWeight(band.resistance)}</span>
							<svg
								class="h-3.5 w-3.5 text-text-muted transition-colors group-hover:text-red-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					{/each}

					<!-- Add band select -->
					{#if bands.length > 0}
						<Select.Root
							type="single"
							onValueChange={(v) => addBand(v)}
							items={bands.map((b) => ({ value: b.id, label: b.name }))}
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
								<span>Add band</span>
							</Select.Trigger>
							<Select.Portal>
								<Select.Content
									class="z-100 max-h-60 overflow-y-auto rounded-lg border border-bg-elevated bg-bg-secondary p-1 shadow-xl"
									sideOffset={4}
								>
									<Select.Viewport>
										{#each bands as band (band.id)}
											<Select.Item
												class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary outline-none data-highlighted:bg-bg-tertiary"
												value={band.id}
												label={band.name}
											>
												<span
													class="h-2.5 w-2.5 shrink-0 rounded-full"
													style:background-color={band.color || '#666'}
												></span>
												<span class="flex-1">{band.name}</span>
												<span class="text-xs text-text-muted"
													>{workout.formatWeight(band.resistance)}</span
												>
											</Select.Item>
										{/each}
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					{:else}
						<p class="text-sm text-text-muted">No bands available</p>
					{/if}
				</div>
			</div>

			<!-- Reps Input -->
			<div class="mt-6 flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<div class="flex items-baseline gap-2">
						<label for="full-reps" class="text-sm font-medium text-text-secondary"
							>Full Reps
							{#if previousData && !currentLog}
								<span class="block text-xs text-text-muted">last time: {previousData.fullReps}</span
								>
							{/if}
						</label>
					</div>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-bg-tertiary text-xl text-text-primary transition-colors hover:bg-bg-elevated"
							onclick={() => (fullReps = Math.max(0, (fullReps ?? 0) - 1))}
						>
							−
						</button>
						<input
							id="full-reps"
							type="number"
							enterkeyhint="done"
							min="0"
							max="999"
							bind:value={fullReps}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									e.currentTarget.blur();
								}
							}}
							onfocus={() => {
								if (fullReps === 0) fullReps = null;
							}}
							onblur={() => {
								if (fullReps === null) fullReps = 0;
							}}
							class="h-10 max-w-16 [appearance:textfield] rounded-lg border-2 border-bg-elevated bg-bg-tertiary text-center text-lg font-semibold text-text-primary focus:border-primary focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
						<button
							type="button"
							class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-bg-tertiary text-xl text-text-primary transition-colors hover:bg-bg-elevated"
							onclick={() => (fullReps = (fullReps ?? 0) + 1)}
						>
							+
						</button>
					</div>
				</div>

				<div class="flex items-center justify-between">
					<div class="flex items-baseline gap-2">
						<label for="partial-reps" class="text-sm font-medium text-text-secondary"
							>Partial Reps
							{#if previousData && !currentLog}
								<span class="block text-xs text-text-muted"
									>last time: {previousData.partialReps}</span
								>
							{/if}
						</label>
					</div>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-bg-tertiary text-xl text-text-primary transition-colors hover:bg-bg-elevated"
							onclick={() => (partialReps = Math.max(0, (partialReps ?? 0) - 1))}
						>
							−
						</button>
						<input
							id="partial-reps"
							type="number"
							enterkeyhint="done"
							min="0"
							max="999"
							bind:value={partialReps}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									e.currentTarget.blur();
								}
							}}
							onfocus={() => {
								if (partialReps === 0) partialReps = null;
							}}
							onblur={() => {
								if (partialReps === null) partialReps = 0;
							}}
							class="h-10 max-w-16 [appearance:textfield] rounded-lg border-2 border-bg-elevated bg-bg-tertiary text-center text-lg font-semibold text-text-primary focus:border-primary focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
						<button
							type="button"
							class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-bg-tertiary text-xl text-text-primary transition-colors hover:bg-bg-elevated"
							onclick={() => (partialReps = (partialReps ?? 0) + 1)}
						>
							+
						</button>
					</div>
				</div>
			</div>

			<!-- Notes Input -->
			<div class="mt-6 flex flex-col gap-2">
				<label for="exercise-notes" class="text-sm font-medium text-text-secondary">Notes</label>
				<textarea
					id="exercise-notes"
					placeholder="Optional notes about this set..."
					bind:value={notes}
					rows="2"
					class="w-full resize-none rounded-lg border-2 border-bg-elevated bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
				></textarea>
			</div>

			<!-- Save Button -->
			<button
				type="button"
				class="btn-primary mt-6 w-full rounded-lg py-3 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={!canSave}
				onclick={handleSave}
			>
				{currentLog ? 'Update' : 'Log Exercise'}
			</button>

			<Dialog.Close
				class="absolute top-4 right-4 rounded-md p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
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
