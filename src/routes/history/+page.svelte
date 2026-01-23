<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import { workout } from '$lib/stores/workout.svelte';
	import type { DetailedSession } from '$lib/stores/workout.svelte';
	import { confirmDialog } from '$lib/components/ConfirmDialog.svelte';
	import SessionCard from '$lib/components/SessionCard.svelte';
	import { flip } from 'svelte/animate';
	import { resolve } from '$app/paths';

	let sessionHistory = $state<DetailedSession[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		sessionHistory = await workout.getDetailedSessionHistory();
		isLoading = false;
	});

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
			sessionHistory = sessionHistory.filter((s) => s.id !== sessionId);
		}
	}
</script>

<div class="flex flex-col gap-6 animate-fade-in">
	<Header title="History" showBack />

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-bg-tertiary border-t-primary"></div>
		</div>
	{:else if sessionHistory.length === 0}
		<div class="flex flex-col items-center gap-4 py-12 text-center">
			<i class="icon-[ph--clipboard-text] text-5xl text-text-muted"></i>
			<div class="flex flex-col gap-1">
				<h3 class="font-display text-lg tracking-wide text-text-secondary uppercase">
					No Workouts Yet
				</h3>
				<p class="text-sm text-text-muted">Complete a workout to see it here</p>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			{#each sessionHistory as session (session.id)}
				<div
					in:slide={{ duration: 150 }}
					out:fade={{ duration: 150, delay: 150 }}
					animate:flip={{ duration: 250, delay: 150 }}
				>
					<SessionCard
						{session}
						onEdit={handleEditSession}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

