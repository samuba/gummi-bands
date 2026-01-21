<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import Stats from '$lib/components/Stats.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import SessionCard from '$lib/components/SessionCard.svelte';
	import { confirmDialog } from '$lib/components/ConfirmDialog.svelte';
	import { startWorkoutDialog } from '$lib/components/StartWorkoutDialog.svelte';
	import StartWorkoutDialog from '$lib/components/StartWorkoutDialog.svelte';
	import type { DetailedSession } from '$lib/stores/workout.svelte';
	import { resolve } from '$app/paths';

	let workoutState = workout.getState();
	let recentSessions = $state<DetailedSession[]>([]);
	let lastTotalSessions = $state(-1);

	async function loadRecentSessions() {
		try {
			recentSessions = await workout.getRecentDetailedSessions(2);
		} catch (error) {
			console.error('Failed to load recent sessions:', error);
		}
	}

	// Initial load when component mounts (guaranteed to run after layout initialization)
	onMount(() => {
		loadRecentSessions();
	});

	// Re-fetch when totalSessions changes (after completing/deleting a workout)
	$effect(() => {
		const currentTotal = workoutState.stats.totalSessions;
		if (lastTotalSessions !== -1 && currentTotal !== lastTotalSessions) {
			loadRecentSessions();
		}
		lastTotalSessions = currentTotal;
	});

	async function handleOpenStartWorkout() {
		const result = await startWorkoutDialog.open();
		if (result) {
			await workout.startSession(result.templateId);
			if (result.templateId) {
				goto(`${resolve('/workout')}?template=${result.templateId}`);
			} else {
				goto(resolve('/workout'));
			}
		}
	}

	async function handleEditSession(sessionId: string) {
		goto(`${resolve('/workout')}?edit=${sessionId}&from=home`);
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

	<div class="flex flex-col items-center gap-6 py-6 text-center">
		<div class="flex flex-col gap-2">
			<h2
				class="bg-clip-text font-display text-3xl tracking-wide text-transparent uppercase"
				style="background-image: var(--gradient-fire)"
			>
				Ready to Stretch Your Limits?
			</h2>
			<p class="text-sm text-text-secondary">Time to put in the work</p>
		</div>

		<!-- Big Start Workout Button -->
		<button
			class="group flex cursor-pointer items-center justify-center gap-4 rounded-2xl border-2 border-primary bg-linear-to-br from-primary to-primary/80 p-4 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-100 w-full max-w-sm"
			onclick={handleOpenStartWorkout}
		>
			<i class="icon-[ph--lightning-fill] text-4xl text-white"></i>
			<span class="font-display text-2xl tracking-wide text-white uppercase">
				Start Workout
			</span>
		</button>
	</div>
	
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
	</div>

	<div class="grid grid-cols-2 gap-4">
		<a
			href={resolve('/bands')}
			class="flex cursor-pointer flex-col gap-2 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<div class="flex items-center gap-3">
				<i class="icon-[ph--infinity] text-2xl text-primary"></i>
				<span class="font-display text-lg tracking-wide text-text-primary"
					>Bands</span
				>
			</div>
			<span class="block text-xs text-text-muted">Add or remove resistance bands</span>
		</a>
		<a
			href={resolve('/exercises')}
			class="flex cursor-pointer flex-col gap-2 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<div class="flex items-center gap-3">
				<i class="icon-[ph--barbell] text-2xl text-primary"></i>
				<span class="font-display text-lg tracking-wide text-text-primary"
					>Exercises</span
				>
			</div>
			<span class="block text-xs text-text-muted">Customize your exercise list</span>
		</a>
		<a
			href={resolve('/templates')}
			class="flex cursor-pointer flex-col gap-2 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<div class="flex items-center gap-3">
				<i class="icon-[ph--lightning] text-2xl text-primary"></i>
				<span class="font-display text-lg tracking-wide text-text-primary"
					>Templates</span
				>
			</div>
			<span class="block text-xs text-text-muted">Create and manage workout templates</span>
		</a>
		<a
			href={resolve('/settings')}
			class="flex cursor-pointer flex-col gap-2 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<div class="flex items-center gap-3">
				<i class="icon-[ph--gear-six] text-2xl text-primary"></i>
				<span class="font-display text-lg tracking-wide text-text-primary"
					>Settings</span
				>
			</div>
			<span class="block text-xs text-text-muted">App preferences and more</span>
		</a>
	</div>
</div>

<StartWorkoutDialog />
