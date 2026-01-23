<script lang="ts">
	import type { Band, Exercise, LoggedExercise } from '$lib/db/schema';
	import { fly } from 'svelte/transition';
	import { settings } from '$lib/stores/settings.svelte';

	interface Props {
		log: LoggedExercise & { exercise: Exercise; bands: Band[] };
		onremove: () => void;
	}

	let { log, onremove }: Props = $props();

	function formatTime(date: Date): string {
		return new Intl.DateTimeFormat(navigator.language, {
			hour: 'numeric',
			minute: '2-digit',
		}).format(new Date(date));
	}

	function getTotalResistance(): number {
		return log.bands.reduce((sum, b) => sum + b.resistance, 0);
	}
</script>

<div class="card flex flex-col gap-2 p-4" transition:fly={{ y: 20, duration: 200 }}>
	<div class="flex items-start justify-between">
		<h3 class="text-base tracking-wide uppercase font-display text-text-primary">{log.exercise.name}</h3>
		<button 
			class="flex items-center justify-center w-7 h-7 transition-all duration-150 bg-transparent border-none cursor-pointer rounded-sm text-text-muted hover:bg-bg-tertiary hover:text-error" 
			onclick={onremove} 
			aria-label="Remove exercise"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>

	<div class="flex flex-col gap-2">
		<div class="flex items-center gap-4">
			<div class="flex flex-col items-center">
				<span class="text-3xl leading-none font-display text-primary">{log.fullReps}</span>
				<span class="text-[0.65rem] uppercase tracking-widest text-text-muted">Full</span>
			</div>
			{#if log.partialReps > 0}
				<span class="text-xl font-display text-text-muted">+</span>
				<div class="flex flex-col items-center">
					<span class="text-3xl leading-none font-display text-secondary">{log.partialReps}</span>
					<span class="text-[0.65rem] uppercase tracking-widest text-text-muted">Partial</span>
				</div>
			{/if}
		</div>

		{#if log.bands.length > 0}
			<div class="flex flex-wrap items-center gap-1">
				{#each log.bands as band (band.id)}
					<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[0.7rem] transition-all duration-200 border rounded-full bg-bg-tertiary text-text-secondary border-transparent">
						<span class="w-1.5 h-1.5 rounded-full" style:background-color={band.color || '#666'}></span>
						{settings.formatWeight(band.resistance)}
					</span>
				{/each}
				<span class="ml-auto text-[0.7rem] text-text-muted">{settings.formatWeight(getTotalResistance())} total</span>
			</div>
		{/if}
	</div>

	<div class="flex justify-end">
		<span class="text-[0.7rem] text-text-muted">{formatTime(log.loggedAt)}</span>
	</div>
</div>
