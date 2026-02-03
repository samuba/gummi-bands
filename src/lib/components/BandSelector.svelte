<script lang="ts">
	import type { Band } from '$lib/db/app/schema';
	import { fade } from 'svelte/transition';
	import { settings } from '$lib/stores/settings.svelte';

	interface Props {
		bands: Band[];
		selectedIds: string[];
		onchange: (ids: string[]) => void;
	}

	let { bands, selectedIds, onchange }: Props = $props();

	function toggleBand(bandId: string) {
		if (selectedIds.includes(bandId)) {
			onchange(selectedIds.filter(id => id !== bandId));
		} else {
			onchange([...selectedIds, bandId]);
		}
	}

	function getTotalResistance(): number {
		return bands
			.filter(b => selectedIds.includes(b.id))
			.reduce((sum, b) => sum + b.resistance, 0);
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<span class="text-sm font-medium text-text-secondary">Select Bands</span>
		{#if selectedIds.length > 0}
			<span class="text-base tracking-wider text-primary font-display" transition:fade={{ duration: 150 }}>
				{settings.formatWeight(getTotalResistance())} total
			</span>
		{/if}
	</div>
	
	<div class="flex flex-wrap gap-2">
		{#each bands as band}
			<button
				class="flex items-center gap-2 px-4 py-2 transition-all duration-200 border-2 rounded-full cursor-pointer bg-bg-tertiary"
				class:selected={selectedIds.includes(band.id)}
				style:border-color={selectedIds.includes(band.id) ? (band.color || '#666') : 'transparent'}
				style:background-color={selectedIds.includes(band.id) ? `color-mix(in srgb, ${band.color || '#666'} 15%, var(--color-bg-tertiary))` : ''}
				onclick={() => toggleBand(band.id)}
			>
				<span 
					class="w-3 h-3 rounded-full" 
					style:background-color={band.color || '#666'}
					style:box-shadow={`0 0 8px ${band.color || '#666'}`}
				></span>
				<span class="text-[0.8rem] text-text-primary whitespace-nowrap">{band.name}</span>
				<span class="text-xs text-text-muted">{settings.formatWeight(band.resistance)}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	button:hover:not(.selected) {
		background-color: var(--color-bg-elevated);
	}
</style>
