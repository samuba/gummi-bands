<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import BandSelector from '$lib/components/BandSelector.svelte';
	import ExerciseSelector from '$lib/components/ExerciseSelector.svelte';
	import RepCounter from '$lib/components/RepCounter.svelte';
	import LoggedExerciseCard from '$lib/components/LoggedExerciseCard.svelte';
	import WorkoutTimer from '$lib/components/WorkoutTimer.svelte';
	import * as workout from '$lib/stores/workout.svelte';

	type View = 'home' | 'workout' | 'bands' | 'exercises';

	let currentView = $state<View>('home');
	let workoutState = workout.getState();

	// Form state for logging exercise
	let selectedExerciseId = $state<string | null>(null);
	let selectedBandIds = $state<string[]>([]);
	let fullReps = $state(0);
	let partialReps = $state(0);

	// Form state for adding bands/exercises
	let newBandName = $state('');
	let newBandResistance = $state(10);
	let newBandColor = $state('#FF4444');
	let newExerciseName = $state('');

	let isLoading = $state(true);

	onMount(async () => {
		await workout.initialize();
		isLoading = false;
	});

	async function handleStartWorkout() {
		await workout.startSession();
		currentView = 'workout';
	}

	async function handleEndWorkout() {
		await workout.endSession();
		currentView = 'home';
	}

	async function handleLogExercise() {
		if (!selectedExerciseId || selectedBandIds.length === 0) return;
		
		await workout.logExercise(selectedExerciseId, selectedBandIds, fullReps, partialReps);
		
		// Reset form but keep bands selected for convenience
		fullReps = 0;
		partialReps = 0;
	}

	async function handleAddBand() {
		if (!newBandName.trim()) return;
		await workout.addBand(newBandName.trim(), newBandResistance, newBandColor);
		newBandName = '';
		newBandResistance = 10;
	}

	async function handleAddExercise() {
		if (!newExerciseName.trim()) return;
		await workout.addExercise(newExerciseName.trim());
		newExerciseName = '';
	}

	function canLogExercise(): boolean {
		return selectedExerciseId !== null && selectedBandIds.length > 0 && (fullReps > 0 || partialReps > 0);
	}
</script>

{#if isLoading}
	<div class="flex flex-col items-center justify-center min-h-[80vh] gap-6" in:fade={{ duration: 200 }}>
		<div class="w-12 h-12 border-4 rounded-full border-bg-tertiary border-t-primary animate-spin"></div>
		<p class="text-sm text-text-secondary">Loading your workouts...</p>
	</div>
{:else}
	{#if currentView === 'home'}
		<div class="flex flex-col gap-6" in:fade={{ duration: 200 }}>
			<Header />
			
			<div class="flex flex-col items-center gap-8 py-8 text-center">
				<div class="flex flex-col gap-2">
					<h2 class="text-3xl tracking-wide uppercase bg-clip-text text-transparent font-display" style="background-image: var(--gradient-fire)">Ready to Stretch Your Limits?</h2>
					<p class="text-sm text-text-secondary">Track your rubber band workout with precision</p>
				</div>
				<button 
					class="flex items-center gap-4 px-12 py-6 text-2xl tracking-widest text-white transition-transform duration-200 border-none cursor-pointer rounded-xl font-display animate-pulse-glow hover:scale-105" 
					style="background-image: var(--gradient-fire)"
					onclick={handleStartWorkout}
				>
					<span class="text-3xl">🔥</span>
					Start Workout
				</button>
			</div>

			<div class="flex flex-col gap-4 card">
				<h3 class="text-sm tracking-wide uppercase text-text-secondary">Your Arsenal</h3>
				<div class="grid grid-cols-3 gap-4">
					<div class="flex flex-col items-center gap-1">
						<span class="text-4xl text-primary font-display">{workoutState.bands.length}</span>
						<span class="text-xs tracking-widest uppercase text-text-muted">Bands</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<span class="text-4xl text-primary font-display">{workoutState.exercises.length}</span>
						<span class="text-xs tracking-widest uppercase text-text-muted">Exercises</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<span class="text-4xl text-primary font-display">{workoutState.recentSessions.length}</span>
						<span class="text-xs tracking-widest uppercase text-text-muted">Sessions</span>
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-4">
				<button class="flex items-center gap-4 p-6 text-left transition-all duration-200 border rounded-lg cursor-pointer bg-bg-secondary border-bg-tertiary hover:border-primary hover:bg-bg-tertiary" onclick={() => currentView = 'bands'}>
					<span class="text-3xl">🎯</span>
					<div>
						<span class="block text-lg tracking-wide text-text-primary font-display">Manage Bands</span>
						<span class="block text-xs text-text-muted">Add or remove resistance bands</span>
					</div>
				</button>
				<button class="flex items-center gap-4 p-6 text-left transition-all duration-200 border rounded-lg cursor-pointer bg-bg-secondary border-bg-tertiary hover:border-primary hover:bg-bg-tertiary" onclick={() => currentView = 'exercises'}>
					<span class="text-3xl">💪</span>
					<div>
						<span class="block text-lg tracking-wide text-text-primary font-display">Manage Exercises</span>
						<span class="block text-xs text-text-muted">Customize your exercise list</span>
					</div>
				</button>
			</div>
		</div>

	{:else if currentView === 'workout'}
		<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
			<div class="flex flex-col gap-2">
				<Header title="Workout" showBack onback={() => currentView = 'home'} />
				{#if workoutState.currentSession}
					<div class="flex justify-center">
						<WorkoutTimer startedAt={workoutState.currentSession.startedAt} />
					</div>
				{/if}
			</div>

			<div class="flex flex-col gap-6 card">
				<ExerciseSelector 
					exercises={workoutState.exercises}
					selectedId={selectedExerciseId}
					onchange={(id) => selectedExerciseId = id}
				/>

				<BandSelector
					bands={workoutState.bands}
					selectedIds={selectedBandIds}
					onchange={(ids) => selectedBandIds = ids}
				/>

				<div class="flex justify-center gap-8">
					<RepCounter
						label="Full Reps"
						value={fullReps}
						onchange={(v) => fullReps = v}
					/>
					<RepCounter
						label="Partial Reps"
						value={partialReps}
						onchange={(v) => partialReps = v}
						accent
					/>
				</div>

				<button 
					class="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
					disabled={!canLogExercise()}
					onclick={handleLogExercise}
				>
					Log Exercise
				</button>
			</div>

			{#if workoutState.sessionLogs.length > 0}
				<div class="flex flex-col gap-4" transition:slide={{ duration: 200 }}>
					<h3 class="text-base font-medium text-text-secondary">Today's Progress</h3>
					<div class="flex flex-col gap-4">
						{#each workoutState.sessionLogs as log (log.id)}
							<LoggedExerciseCard 
								{log}
								onremove={() => workout.removeLoggedExercise(log.id)}
							/>
						{/each}
					</div>
				</div>
			{/if}

			<button class="mt-4 btn-secondary" onclick={handleEndWorkout}>
				End Workout
			</button>
		</div>

	{:else if currentView === 'bands'}
		<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
			<Header title="Bands" showBack onback={() => currentView = 'home'} />

			<div class="flex flex-col gap-4 card">
				<h3 class="text-base font-medium text-text-secondary">Add New Band</h3>
				<div class="flex gap-4">
					<input
						type="text"
						placeholder="Band name (e.g., Red - Light)"
						bind:value={newBandName}
					/>
				</div>
				<div class="grid grid-cols-[1fr_auto] gap-4">
					<div class="flex flex-col gap-1">
						<label class="text-xs tracking-wide uppercase text-text-muted" for="resistance">Resistance (lbs)</label>
						<input
							id="resistance"
							type="number"
							min="1"
							max="200"
							bind:value={newBandResistance}
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs tracking-wide uppercase text-text-muted" for="color">Color</label>
						<input
							id="color"
							type="color"
							class="w-[60px] h-11 p-1 border-none cursor-pointer rounded-md bg-transparent"
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
					<div class="flex items-center gap-4 p-4 border rounded-md bg-bg-secondary border-bg-tertiary" transition:slide={{ duration: 150 }}>
						<div class="flex-shrink-0 w-6 h-6 rounded-sm" style:background={band.color || '#666'}></div>
						<div class="flex flex-col flex-1 gap-0.5">
							<span class="text-sm text-text-primary">{band.name}</span>
							<span class="text-xs text-text-muted">{band.resistance} lbs</span>
						</div>
						<button class="btn-ghost" onclick={() => workout.deleteBand(band.id)} aria-label="Delete {band.name}">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="3 6 5 6 21 6" />
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>

	{:else if currentView === 'exercises'}
		<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
			<Header title="Exercises" showBack onback={() => currentView = 'home'} />

			<div class="flex flex-col gap-4 card">
				<h3 class="text-base font-medium text-text-secondary">Add New Exercise</h3>
				<div class="flex gap-4">
					<input
						type="text"
						placeholder="Exercise name (e.g., Bicep Curls)"
						bind:value={newExerciseName}
					/>
				</div>
				<button class="btn-primary" onclick={handleAddExercise} disabled={!newExerciseName.trim()}>
					Add Exercise
				</button>
			</div>

			<div class="flex flex-col gap-2">
				{#each workoutState.exercises as exercise (exercise.id)}
					<div class="flex items-center gap-4 p-4 border rounded-md bg-bg-secondary border-bg-tertiary" transition:slide={{ duration: 150 }}>
						<div class="text-xl">💪</div>
						<div class="flex flex-col flex-1 gap-0.5">
							<span class="text-sm text-text-primary">{exercise.name}</span>
						</div>
						<button class="btn-ghost" onclick={() => workout.deleteExercise(exercise.id)} aria-label="Delete {exercise.name}">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="3 6 5 6 21 6" />
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/if}
