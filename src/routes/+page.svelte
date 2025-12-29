<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import * as workout from '$lib/stores/workout.svelte';

	let workoutState = workout.getState();

	async function handleStartWorkout(templateId?: string) {
		await workout.startSession(templateId);
		if (templateId) {
			goto(`/workout?template=${templateId}`);
		} else {
			goto('/workout');
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

	<div class="card flex flex-col gap-4">
		<h3 class="text-sm tracking-wide text-text-secondary uppercase">Your Arsenal</h3>
		<div class="grid grid-cols-3 gap-4">
			<div class="flex flex-col items-center gap-1">
				<span class="font-display text-4xl text-primary">{workoutState.bands.length}</span>
				<span class="text-xs tracking-widest text-text-muted uppercase">Bands</span>
			</div>
			<div class="flex flex-col items-center gap-1">
				<span class="font-display text-4xl text-primary">{workoutState.exercises.length}</span>
				<span class="text-xs tracking-widest text-text-muted uppercase">Exercises</span>
			</div>
			<div class="flex flex-col items-center gap-1">
				<span class="font-display text-4xl text-primary"
					>{workoutState.recentSessions.length}</span
				>
				<span class="text-xs tracking-widest text-text-muted uppercase">Sessions</span>
			</div>
		</div>
	</div>

	<div class="flex flex-col gap-4">
		<a
			href="/history"
			class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<i class="icon-[ph--chart-line] text-3xl text-primary"></i>
			<div>
				<span class="block font-display text-lg tracking-wide text-text-primary"
					>Workout History</span
				>
				<span class="block text-xs text-text-muted">View and edit past sessions</span>
			</div>
		</a>
		<a
			href="/bands"
			class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<i class="icon-[ph--infinity] text-3xl text-primary"></i>
			<div>
				<span class="block font-display text-lg tracking-wide text-text-primary"
					>Manage Bands</span
				>
				<span class="block text-xs text-text-muted">Add or remove resistance bands</span>
			</div>
		</a>
		<a
			href="/exercises"
			class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
		>
			<i class="icon-[ph--barbell] text-3xl text-primary"></i>
			<div>
				<span class="block font-display text-lg tracking-wide text-text-primary"
					>Manage Exercises</span
				>
				<span class="block text-xs text-text-muted">Customize your exercise list</span>
			</div>
		</a>
	</div>
</div>
