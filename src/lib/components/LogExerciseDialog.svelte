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
	let fullReps = $state(0);
	let partialReps = $state(0);
	let notes = $state('');
	let previousData = $state<workout.PreviousExerciseData>(null);
	let isLoadingPrevious = $state(false);

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
			isLoadingPrevious = true;
			previousData = await workout.getPreviousExerciseData(exercise.id);
			isLoadingPrevious = false;

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
		onlog(selectedBandIds, fullReps, partialReps, notes.trim() || undefined);
		handleOpenChange(false);
	}

	function getTotalResistance(): number {
		return selectedBandIds.reduce((sum, id) => {
			const band = bands.find((b) => b.id === id);
			return sum + (band?.resistance || 0);
		}, 0);
	}

	const canSave = $derived(selectedBandIds.length > 0 && (fullReps > 0 || partialReps > 0));
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Trigger class="w-full text-left">
		<div
			class="flex items-start justify-between p-4 transition-all duration-150 border-b cursor-pointer border-bg-tertiary hover:bg-bg-tertiary"
		>
			<div class="flex flex-col gap-1">
				<span class="font-semibold text-text-primary">{exercise.name}</span>
				{#if currentLog && currentLog.bands.length > 0}
					<span class="text-sm text-text-muted">
						{currentLog.bands.map((b) => b.name).join(', ')}
					</span>
				{:else}
					<span class="text-sm italic text-text-muted">Tap to log</span>
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
			<Dialog.Title class="text-xl font-semibold tracking-wide text-text-primary font-display">
				{exercise.name}
			</Dialog.Title>

			{#if isLoadingPrevious}
				<div class="flex items-center justify-center py-8">
					<div
						class="w-8 h-8 border-4 rounded-full border-bg-tertiary border-t-primary animate-spin"
					></div>
				</div>
			{:else}
				<!-- Band Selection -->
				<div class="flex flex-col gap-3 mt-6">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-text-secondary">Bands</span>
						{#if selectedBandIds.length > 0}
							<span class="text-sm text-primary">{getTotalResistance()} lbs</span>
						{/if}
					</div>

					<!-- Selected bands list -->
					{#if selectedBandsWithIndex.length > 0}
						<div class="flex flex-col gap-2">
							{#each selectedBandsWithIndex as { band, index } (index)}
								<button
									type="button"
									class="flex items-center gap-3 p-3 text-left border rounded-lg cursor-pointer bg-bg-tertiary border-bg-elevated hover:bg-bg-elevated group"
									onclick={() => removeBandAtIndex(index)}
									animate:flip={{ duration: 200 }}
									in:fade={{ duration: 150 }}
									out:fade={{ duration: 100 }}
								>
									<span
										class="w-3 h-3 rounded-full shrink-0"
										style:background-color={band.color || '#666'}
										style:box-shadow={`0 0 8px ${band.color || '#666'}, 0 0 12px ${band.color || '#666'}50`}
									></span>
									<span class="flex-1 text-sm font-medium text-text-primary">{band.name}</span>
									<span class="text-xs text-text-muted">{band.resistance} lbs</span>
									<svg
										class="w-4 h-4 transition-colors text-text-muted group-hover:text-red-400"
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
						</div>
					{/if}

					<!-- Add band select -->
					{#if bands.length > 0}
						<Select.Root
							type="single"
							onValueChange={(v) => addBand(v)}
							items={bands.map((b) => ({ value: b.id, label: b.name }))}
						>
							<Select.Trigger
								class="flex items-center w-full gap-2 px-3 py-2.5 text-sm transition-colors border-2 border-dashed rounded-lg bg-bg-tertiary border-bg-elevated text-text-muted hover:border-primary hover:text-text-secondary focus:outline-none focus:border-primary"
							>
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<line x1="12" y1="5" x2="12" y2="19" />
									<line x1="5" y1="12" x2="19" y2="12" />
								</svg>
								<span class="flex-1 text-left">Add a band...</span>
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<polyline points="6 9 12 15 18 9" />
								</svg>
							</Select.Trigger>
							<Select.Portal>
								<Select.Content
									class="z-[100] max-h-60 overflow-y-auto rounded-lg border border-bg-elevated bg-bg-secondary p-1 shadow-xl"
									sideOffset={4}
								>
									<Select.Viewport>
										{#each bands as band (band.id)}
											<Select.Item
												class="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer text-text-primary data-[highlighted]:bg-bg-tertiary outline-none"
												value={band.id}
												label={band.name}
											>
												<span
													class="w-2.5 h-2.5 rounded-full shrink-0"
													style:background-color={band.color || '#666'}
												></span>
												<span class="flex-1">{band.name}</span>
												<span class="text-xs text-text-muted">{band.resistance} lbs</span>
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

				<!-- Reps Input -->
				<div class="flex flex-col gap-4 mt-6">
					<div class="flex items-center justify-between">
						<div class="flex items-baseline gap-2">
							<label for="full-reps" class="text-sm font-medium text-text-secondary">Full Reps</label>
							{#if previousData && !currentLog}
								<span class="text-xs text-text-muted">(prev: {previousData.fullReps})</span>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="flex items-center justify-center w-10 h-10 text-xl transition-colors rounded-lg cursor-pointer bg-bg-tertiary text-text-primary hover:bg-bg-elevated"
								onclick={() => (fullReps = Math.max(0, fullReps - 1))}
							>
								−
							</button>
							<input
								id="full-reps"
								type="number"
								min="0"
								max="999"
								bind:value={fullReps}
								class="max-w-16 h-10 text-lg font-semibold text-center border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							/>
							<button
								type="button"
								class="flex items-center justify-center w-10 h-10 text-xl transition-colors rounded-lg cursor-pointer bg-bg-tertiary text-text-primary hover:bg-bg-elevated"
								onclick={() => (fullReps = fullReps + 1)}
							>
								+
							</button>
						</div>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-baseline gap-2">
							<label for="partial-reps" class="text-sm font-medium text-text-secondary">Partial Reps</label>
							{#if previousData && !currentLog}
								<span class="text-xs text-text-muted">(prev: {previousData.partialReps})</span>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="flex items-center justify-center w-10 h-10 text-xl transition-colors rounded-lg cursor-pointer bg-bg-tertiary text-text-primary hover:bg-bg-elevated"
								onclick={() => (partialReps = Math.max(0, partialReps - 1))}
							>
								−
							</button>
							<input
								id="partial-reps"
								type="number"
								min="0"
								max="999"
								bind:value={partialReps}
								class="max-w-16 h-10 text-lg font-semibold text-center border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							/>
							<button
								type="button"
								class="flex items-center justify-center w-10 h-10 text-xl transition-colors rounded-lg cursor-pointer bg-bg-tertiary text-text-primary hover:bg-bg-elevated"
								onclick={() => (partialReps = partialReps + 1)}
							>
								+
							</button>
						</div>
					</div>
				</div>

				<!-- Notes Input -->
				<div class="flex flex-col gap-2 mt-6">
					<label for="exercise-notes" class="text-sm font-medium text-text-secondary">Notes</label>
					<textarea
						id="exercise-notes"
						placeholder="Optional notes about this set..."
						bind:value={notes}
						rows="2"
						class="w-full px-3 py-2 text-sm border-2 rounded-lg resize-none bg-bg-tertiary border-bg-elevated text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
					></textarea>
				</div>

				<!-- Save Button -->
				<button
					type="button"
					class="w-full py-3 mt-6 font-semibold transition-all duration-200 rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={!canSave}
					onclick={handleSave}
				>
					{currentLog ? 'Update' : 'Log Exercise'}
				</button>
			{/if}

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


