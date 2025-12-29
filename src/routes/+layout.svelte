<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as workout from '$lib/stores/workout.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import type { Band, Exercise } from '$lib/db/schema';

	let { children } = $props();

	let isLoading = $state(true);
	let loadingError = $state<Error | null>(null);

	// Confirmation dialog state (shared across routes)
	let confirmDialogOpen = $state(false);
	let pendingDeleteType = $state<'band' | 'exercise' | null>(null);
	let pendingDeleteItem = $state<Band | Exercise | null>(null);

	onMount(async () => {
		try {
			await workout.initialize();
		} catch (error) {
			console.error(error);
			loadingError = error as Error;
		}
		isLoading = false;
	});

	// Confirm delete handlers
	function requestDeleteBand(band: Band) {
		pendingDeleteType = 'band';
		pendingDeleteItem = band;
		confirmDialogOpen = true;
	}

	function requestDeleteExercise(exercise: Exercise) {
		pendingDeleteType = 'exercise';
		pendingDeleteItem = exercise;
		confirmDialogOpen = true;
	}

	async function handleConfirmDelete() {
		if (!pendingDeleteItem || !pendingDeleteType) return;

		if (pendingDeleteType === 'band') {
			await workout.deleteBand(pendingDeleteItem.id);
		} else if (pendingDeleteType === 'exercise') {
			await workout.deleteExercise(pendingDeleteItem.id);
		}

		pendingDeleteType = null;
		pendingDeleteItem = null;
	}

	function handleCancelDelete() {
		pendingDeleteType = null;
		pendingDeleteItem = null;
	}

	function getConfirmDialogTitle(): string {
		if (pendingDeleteType === 'band') return 'Delete Band?';
		if (pendingDeleteType === 'exercise') return 'Delete Exercise?';
		return 'Delete Item?';
	}

	function getConfirmDialogDescription(): string {
		if (!pendingDeleteItem) return 'This action cannot be undone.';
		if (pendingDeleteType === 'band') {
			return `Are you sure you want to delete "${pendingDeleteItem.name}"? This will remove it from your available bands.`;
		}
		if (pendingDeleteType === 'exercise') {
			return `Are you sure you want to delete "${pendingDeleteItem.name}"? This will remove it from your exercise list.`;
		}
		return 'This action cannot be undone.';
	}

	// Export functions to child routes via context
	import { setContext } from 'svelte';

	setContext('deleteHandlers', {
		requestDeleteBand,
		requestDeleteExercise
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gummi Bands - Workout Tracker</title>
	<meta name="description" content="Track your rubber band workouts with ease" />
	<meta name="theme-color" content="#0D0D0D" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<div class="relative z-[1] min-h-screen max-w-[480px] mx-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom,0))]">
	{#if isLoading}
		<div
			class="flex min-h-[80vh] flex-col items-center justify-center gap-6"
			in:fade={{ duration: 200 }}
		>
			{#if loadingError}
				<div class="flex flex-col items-center justify-center gap-6">
					<i class="icon-[ph--warning] text-5xl text-error"></i>
					<p class="text-sm text-text-secondary">
						An error occurred while loading the Database.
					</p>
					<p>
						{loadingError.message}
					</p>
				</div>
			{:else}
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-bg-tertiary border-t-primary"
				></div>
				<p class="text-sm text-text-secondary">Loading your workouts...</p>
			{/if}
		</div>
	{:else}
		{@render children()}
	{/if}
</div>

<!-- Confirmation Dialog -->
<ConfirmDialog
	bind:open={confirmDialogOpen}
	title={getConfirmDialogTitle()}
	description={getConfirmDialogDescription()}
	confirmText="Delete"
	cancelText="Cancel"
	variant="danger"
	onconfirm={handleConfirmDelete}
	oncancel={handleCancelDelete}
/>
