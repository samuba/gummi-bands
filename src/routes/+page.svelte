<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import Stats from '$lib/components/Stats.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import SessionCard from '$lib/components/SessionCard.svelte';
	import { confirmDialog } from '$lib/components/ConfirmDialog.svelte';
	import type { DetailedSession } from '$lib/stores/workout.svelte';
	import { resolve } from '$app/paths';

	let workoutState = workout.getState();
	let recentSessions = $state<DetailedSession[]>([]);

	$effect(() => {
		if (workoutState.isInitialized) {
			// Dependencies to trigger re-fetch
			const _ = workoutState.stats.totalSessions;
			workout.getRecentDetailedSessions(2).then((sessions) => {
				recentSessions = sessions;
			});
		}
	});

	async function handleStartWorkout(templateId?: string) {
		await workout.startSession(templateId);
		if (templateId) {
			goto(`${resolve('/workout')}?template=${templateId}`);
		} else {
			goto(resolve('/workout'));
		}
	}

	async function handleEditSession(sessionId: string) {
		goto(`${resolve('/workout')}?edit=${sessionId}`);
	}

	async function handleDeleteSession(sessionId: string) {
		const confirmed = await confirmDialog.confirm({
			title: 'Delete Workout?',
			html: 'Are you sure you want to delete this workout session? This action cannot be undone.',
			confirmText: 'Delete',
			cancelText: 'Cancel',
			iconClass: 'icon-[ph--trash]'
		});

		if (confirmed) {
			await workout.deleteSession(sessionId);
			// Optimistic update
			recentSessions = recentSessions.filter((s) => s.id !== sessionId);
		}
	}
</script>

<div class="flex flex-col gap-6" in:fade={{ duration: 200 }}>
	<Header />

	<div class="flex flex-col items-center gap-4 py-6 text-center">
		<div class="flex flex-col gap-2">
			<h2
				class="bg-clip-text font-display text-3xl tracking-wide text-transparent uppercase"
				style="background-image: var(--gradient-fire)"
			>
				Ready to Stretch Your Limits?
			</h2>
			<p class="text-sm text-text-secondary">Choose a workout template or go freestyle</p>
		</div>
	</div>

	<!-- Workout Templates -->
	{#if workoutState.templates.length > 0}
		<div class="flex flex-col gap-3">
			<h3 class="text-sm tracking-wide text-text-secondary uppercase">Start Workout</h3>
			<div class="flex flex-col gap-3">
				{#each workoutState.templates as template (template.id)}
					<button
						class="group flex cursor-pointer items-center gap-3 rounded-lg border-2 border-bg-tertiary bg-bg-secondary p-4 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
						onclick={() => handleStartWorkout(template.id)}
					>
						<i class="icon-[ph--lightning-fill] text-3xl text-amber-400"></i>
						<span
							class="font-display text-lg tracking-wide text-text-primary group-hover:text-primary"
							>{template.name}</span
						>
						<span class="ml-auto font-display text-xs tracking-widest text-primary uppercase"
							>Start →</span
						>
					</button>
				{/each}
				<button
					class="flex cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed border-bg-elevated bg-bg-secondary/50 p-4 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
					onclick={() => handleStartWorkout()}
				>
					<div class="flex-1">
						<span class="block font-display text-lg tracking-wide text-text-primary"
							>Custom Workout</span
						>
						<span class="block text-xs text-text-muted">Add exercises as you go</span>
					</div>
					<span class="font-display text-xs tracking-widest text-text-secondary uppercase"
						>Start →</span
					>
				</button>
			</div>
		</div>
	{/if}
	
	<Stats />

	<div class="flex flex-col gap-4">
		{#if recentSessions.length > 0}
			<div class="flex flex-col gap-3">
				<div class="flex items-center justify-between px-1">
					<h3 class="text-sm tracking-wide text-text-secondary uppercase">Recent Activity</h3>
				</div>

				{#each recentSessions as session (session.id)}
					<SessionCard
						{session}
						onEdit={handleEditSession}
						onDelete={handleDeleteSession}
					/>
				{/each}

				<div class="mt-2 mb-2 flex justify-center">
					<a
						href={resolve('/history')}
						class="font-display text-xs tracking-widest text-primary uppercase transition-colors hover:text-primary/80"
					>
						Show All History →
					</a>
				</div>
			</div>
		{:else}
			<a
				href={resolve('/history')}
				class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
			>
				<i class="icon-[ph--clipboard-text] text-3xl text-primary"></i>
				<div>
					<span class="block font-display text-lg tracking-wide text-text-primary"
						>Workout History</span
					>
					<span class="block text-xs text-text-muted">View and edit past sessions</span>
				</div>
			</a>
		{/if}
		<a
			href={resolve('/bands')}
			class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<i class="icon-[ph--infinity] text-3xl text-primary"></i>
			<div>
				<span class="block font-display text-lg tracking-wide text-text-primary"
					>Bands</span
				>
				<span class="block text-xs text-text-muted">Add or remove resistance bands</span>
			</div>
		</a>
		<a
			href={resolve('/exercises')}
			class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<i class="icon-[ph--barbell] text-3xl text-primary"></i>
			<div>
				<span class="block font-display text-lg tracking-wide text-text-primary"
					>Exercises</span
				>
				<span class="block text-xs text-text-muted">Customize your exercise list</span>
			</div>
		</a>
		<a
			href={resolve('/settings')}
			class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<i class="icon-[ph--gear-six] text-3xl text-primary"></i>
			<div>
				<span class="block font-display text-lg tracking-wide text-text-primary"
					>Settings</span
				>
				<span class="block text-xs text-text-muted">Units, app preferences and more</span>
			</div>
		</a>
	</div>
</div>
