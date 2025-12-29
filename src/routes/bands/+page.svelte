<script lang="ts">
	import { slide } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import { getContext } from 'svelte';
	import type { Band } from '$lib/db/schema';

	let workoutState = workout.getState();

	// Form state for adding bands
	let newBandName = $state('');
	let newBandResistance = $state(10);
	let newBandColor = $state('#FF4444');

	// Get delete handlers from layout context
	const { requestDeleteBand } = getContext<{
		requestDeleteBand: (band: Band) => void;
	}>('deleteHandlers');

	async function handleAddBand() {
		if (!newBandName.trim()) return;
		await workout.addBand(newBandName.trim(), newBandResistance, newBandColor);
		newBandName = '';
		newBandResistance = 10;
	}
</script>

<div class="flex flex-col gap-6 animate-fade-in">
	<Header title="Bands" showBack />

	<div class="card flex flex-col gap-4">
		<h3 class="text-base font-medium text-text-secondary">Add New Band</h3>
		<div class="flex gap-4">
			<input type="text" placeholder="Band name (e.g., Red - Light)" bind:value={newBandName} />
		</div>
		<div class="grid grid-cols-[1fr_auto] gap-4">
			<div class="flex flex-col gap-1">
				<label class="text-xs tracking-wide text-text-muted uppercase" for="resistance"
					>Resistance (lbs)</label
				>
				<input id="resistance" type="number" min="1" max="200" bind:value={newBandResistance} />
			</div>
			<div class="flex flex-col gap-1">
				<label class="text-xs tracking-wide text-text-muted uppercase" for="color">Color</label>
				<input
					id="color"
					type="color"
					class="h-11 w-[60px] cursor-pointer rounded-md border-none bg-transparent p-1"
					bind:value={newBandColor}
				/>
			</div>
		</div>
		<button class="btn-primary" onclick={handleAddBand} disabled={!newBandName.trim()}>
			Add Band
		</button>
	</div>

	<div class="flex flex-col gap-2">
		{#each workoutState.bands as band (band.id)}
			<div
				class="flex items-center gap-4 rounded-md border border-bg-tertiary bg-bg-secondary p-4"
				transition:slide={{ duration: 150 }}
			>
				<div class="h-6 w-6 shrink-0 rounded-sm" style:background={band.color || '#666'}></div>
				<div class="flex flex-1 flex-col gap-0.5">
					<span class="text-sm text-text-primary">{band.name}</span>
					<span class="text-xs text-text-muted">{band.resistance} lbs</span>
				</div>
				<button
					class="btn-ghost"
					onclick={() => requestDeleteBand(band)}
					aria-label="Delete {band.name}"
				>
					<i class="icon-[ph--trash] size-5"></i>
				</button>
			</div>
		{/each}
	</div>
</div>

