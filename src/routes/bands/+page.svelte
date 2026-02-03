<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import { editBandDialog } from '$lib/components/EditBandDialog.svelte';
	import { workout } from '$lib/stores/workout.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { Band } from '$lib/db/app/schema';
	import { flip } from 'svelte/animate';

	// Form state for adding bands
	let newBandName = $state('');
	let newBandResistance = $state(settings.weightUnit === 'lbs' ? 10 : 5);
	let newBandColor = $state('#FF4444');

	async function handleAddBand() {
		if (!newBandName.trim()) return;
		// Convert resistance to lbs if currently in kg
		const resistanceInLbs = settings.fromUserWeight(newBandResistance);
		await workout.addBand(newBandName.trim(), resistanceInLbs, newBandColor);
		newBandName = '';
		newBandResistance = settings.weightUnit === 'lbs' ? 10 : 5;
	}

	async function handleEditBand(band: Band) {
		const result = await editBandDialog.open({
			id: band.id,
			name: band.name,
			resistance: settings.toUserWeight(band.resistance),
			color: band.color || '#666666'
		});

		if (result) {
			if (result.action === 'delete') {
				await workout.deleteBand(band.id);
			} else {
				// Convert result back to lbs before updating
				const resistanceInLbs = settings.fromUserWeight(result.resistance);
				await workout.updateBand(band.id, result.name, resistanceInLbs, result.color);
			}
		}
	}
</script>

<div class="flex flex-col gap-6 animate-in fade-in">
	<Header title="Bands" showBack />

	<div class="card flex flex-col gap-4 p-6">
		<h3 class="text-base font-medium text-text-secondary">Add New Band</h3>
		<div class="flex gap-4">
			<input type="text" placeholder="Band name (e.g., Red - Light)" bind:value={newBandName} />
		</div>
		<div class="grid grid-cols-[1fr_auto] gap-4">
			<div class="flex flex-col gap-1">
				<label class="text-xs tracking-wide text-text-muted uppercase" for="resistance">
					Resistance ({settings.weightUnit})
				</label>
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
		{#each workout.allBands as band (band.id)}
			<button
				class="card card-hover px-5 py-3 flex items-center gap-4 text-left w-full active:bg-bg-elevated"
				in:slide={{ duration: 150 }}
				out:fade={{ duration: 150, delay: 150 }}
				animate:flip={{ duration: 250, delay: 150 }}
				onclick={() => handleEditBand(band)}
			>
				<div class="h-6 w-6 shrink-0 rounded-sm" style:background={band.color || '#666'}></div>
				<div class="flex flex-1 flex-col gap-0.5">
					<span class="text-sm text-text-primary">{band.name}</span>
					<span class="text-xs text-text-muted">{settings.formatWeight(band.resistance)}</span>
				</div>
				<i class="icon-[ph--caret-right] size-5 text-text-muted"></i>
			</button>
		{/each}
	</div>
</div>
