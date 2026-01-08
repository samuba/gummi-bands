<script lang="ts">
	import { slide, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import * as workout from '$lib/stores/workout.svelte';
	import type { DetailedSession } from '$lib/stores/workout.svelte';

	interface Props {
		session: DetailedSession;
		onEdit: (id: string) => void;
	}

	let { session, onEdit }: Props = $props();

	// Format workout date
	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat(navigator.language, {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric'
		}).format(new Date(date));
	}

	// Format session duration
	function formatSessionDuration(start: Date, end: Date | null): string {
		const startDate = new Date(start);
		const timeStr = new Intl.DateTimeFormat(navigator.language, {
			hour: 'numeric',
			minute: '2-digit'
		}).format(startDate);

		if (!end) return `Started at ${timeStr}`;

		const endDate = new Date(end);
		const durationMs = endDate.getTime() - startDate.getTime();
		const minutes = Math.floor(durationMs / 60000);

		if (minutes < 60) {
			return `${timeStr} · ${minutes} min`;
		}
		const hours = Math.floor(minutes / 60);
		const remainingMins = minutes % 60;
		return `${timeStr} · ${hours}h ${remainingMins}m`;
	}
</script>

<div
	class="relative overflow-hidden rounded-lg border border-bg-tertiary bg-bg-secondary"
>
	<!-- Session Header -->
	<div class="flex items-center justify-between border-b border-bg-tertiary p-4">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<span class="font-display text-xl text-primary">
					{formatDate(session.startedAt)}
				</span>
				{#if session.templateName}
					<span
						class="rounded bg-bg-tertiary px-2 py-0.5 text-[0.65rem] tracking-wider text-text-muted uppercase"
					>
						{session.templateName}
					</span>
				{/if}
			</div>
			<span class="text-xs text-text-muted">
				{formatSessionDuration(session.startedAt, session.endedAt)}
			</span>
		</div>
		<button
			class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-bg-elevated bg-bg-tertiary text-text-secondary transition-all duration-200 hover:border-primary hover:text-primary"
			onclick={() => onEdit(session.id)}
			aria-label="Edit session"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	</div>

	<!-- Exercises List -->
	{#if session.logs.length > 0}
		<div class="flex flex-col divide-y divide-bg-tertiary">
			{#each session.logs as log (log.id)}
				<div 
					animate:flip={{ duration: 250 }} 
					in:slide={{ duration: 200 }} 
					out:fade={{ duration: 150, delay: 150 }} 
					class="flex flex-col gap-2 p-4">
					<div class="flex items-center justify-between">
						<span class="font-display text-sm tracking-wide text-text-primary uppercase"
							>{log.exerciseName}</span
						>
						<div class="flex items-center gap-2">
							<span class="font-display text-lg text-primary">{log.fullReps}</span>
							{#if log.partialReps > 0}
								<span class="font-display text-sm text-text-muted">+</span>
								<span class="font-display text-lg text-secondary">{log.partialReps}</span>
							{/if}
							<span class="text-[0.65rem] tracking-wider text-text-muted uppercase">
								reps
							</span>
						</div>
					</div>
					{#if log.bands.length > 0}
						<div class="flex flex-wrap items-center gap-1">
							{#each log.bands as band (band.id)}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-0.5 text-[0.65rem] text-text-secondary"
								>
									<span
										class="h-1.5 w-1.5 rounded-full"
										style:background-color={band.color || '#666'}
									></span>
									{band.name}
								</span>
							{/each}
							<span class="ml-auto text-[0.65rem] text-text-muted">
								{workout.formatWeight(log.bands.reduce((sum, b) => sum + b.resistance, 0))}
							</span>
						</div>
					{/if}
					{#if log.notes}
						<p class="text-xs text-text-muted italic">"{log.notes}"</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Session Notes -->
	{#if session.notes}
		<div class="border-t border-bg-tertiary bg-bg-tertiary/30 px-4 py-3">
			<p class="text-xs text-text-secondary">
				<i class="mr-1 icon-[ph--note-pencil] text-text-muted"></i>
				{session.notes}
			</p>
		</div>
	{/if}
</div>
