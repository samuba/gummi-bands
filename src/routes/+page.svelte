<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import WorkoutTimer from '$lib/components/WorkoutTimer.svelte';
	import AddExerciseDialog from '$lib/components/AddExerciseDialog.svelte';
	import LogExerciseDialog from '$lib/components/LogExerciseDialog.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import type { Exercise } from '$lib/db/schema';
	import type { DetailedSession } from '$lib/stores/workout.svelte';

	type View = 'home' | 'workout' | 'bands' | 'exercises' | 'history';

	let currentView = $state<View>('home');
	let workoutState = workout.getState();

	// Form state for adding bands/exercises
	let newBandName = $state('');
	let newBandResistance = $state(10);
	let newBandColor = $state('#FF4444');
	let newExerciseName = $state('');
	let sessionNotes = $state('');

	let isLoading = $state(true);

	// History state
	let sessionHistory = $state<DetailedSession[]>([]);
	let isEditingSession = $state(false);

	onMount(async () => {
		await workout.initialize();
		isLoading = false;
	});

	async function loadHistory() {
		sessionHistory = await workout.getDetailedSessionHistory();
	}

	async function handleStartWorkout(templateId?: string) {
		await workout.startSession(templateId);
		sessionNotes = '';
		currentView = 'workout';
	}

	async function handleEndWorkout() {
		if (isEditingSession) {
			await workout.saveEditedSession(sessionNotes.trim() || undefined);
			isEditingSession = false;
		} else {
			await workout.endSession(sessionNotes.trim() || undefined);
		}
		sessionNotes = '';
		currentView = 'home';
	}

	async function handleOpenHistory() {
		await loadHistory();
		currentView = 'history';
	}

	async function handleEditSession(sessionId: string) {
		const session = await workout.editSession(sessionId);
		if (session) {
			sessionNotes = session.notes || '';
			isEditingSession = true;
			currentView = 'workout';
		}
	}

	async function handleLogExercise(exerciseId: string, bandIds: string[], fullReps: number, partialReps: number, notes?: string) {
		// Check if there's already a log for this exercise in current session
		const existingLog = workoutState.sessionLogs.find(log => log.exerciseId === exerciseId);
		if (existingLog) {
			// Remove existing log first
			await workout.removeLoggedExercise(existingLog.id);
		}
		// Log the new data
		await workout.logExercise(exerciseId, bandIds, fullReps, partialReps, notes);
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

	// Get current log for an exercise
	function getExerciseLog(exerciseId: string) {
		const log = workoutState.sessionLogs.find(l => l.exerciseId === exerciseId);
		if (!log) return undefined;
		return {
			fullReps: log.fullReps,
			partialReps: log.partialReps,
			bands: log.bands,
			notes: log.notes
		};
	}

	// Format workout date
	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('en-GB', {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric'
		}).format(new Date(date)).replace(/\//g, '.');
	}

	// Format session duration
	function formatSessionDuration(start: Date, end: Date | null): string {
		const startDate = new Date(start);
		const timeStr = new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
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

{#if isLoading}
	<div class="flex flex-col items-center justify-center min-h-[80vh] gap-6" in:fade={{ duration: 200 }}>
		<div class="w-12 h-12 border-4 rounded-full border-bg-tertiary border-t-primary animate-spin"></div>
		<p class="text-sm text-text-secondary">Loading your workouts...</p>
	</div>
{:else}
	{#if currentView === 'home'}
		<div class="flex flex-col gap-6" in:fade={{ duration: 200 }}>
			<Header />
			
			<div class="flex flex-col items-center gap-4 py-6 text-center">
				<div class="flex flex-col gap-2">
					<h2 class="text-3xl tracking-wide uppercase bg-clip-text text-transparent font-display" style="background-image: var(--gradient-fire)">Ready to Stretch Your Limits?</h2>
					<p class="text-sm text-text-secondary">Choose a workout template or go freestyle</p>
				</div>
			</div>

			<!-- Workout Templates -->
			{#if workoutState.templates.length > 0}
				<div class="flex flex-col gap-3">
					<h3 class="text-sm tracking-wide uppercase text-text-secondary">Start Workout</h3>
					<div class="flex flex-col gap-3">
						{#each workoutState.templates as template (template.id)}
							<button 
								class="flex items-center gap-3 p-4 text-left transition-all duration-200 border-2 rounded-lg cursor-pointer bg-bg-secondary border-bg-tertiary hover:border-primary hover:bg-bg-tertiary group"
								onclick={() => handleStartWorkout(template.id)}
							>
							   	<span class="text-3xl">⚡</span>
								<span class="text-lg tracking-wide text-text-primary font-display group-hover:text-primary">{template.name}</span>
								<span class="ml-auto text-xs tracking-widest uppercase text-primary font-display">Start →</span>
							</button>
						{/each}
						<button 
						class="flex items-center gap-4 p-4 text-left transition-all duration-200 border-2 border-dashed rounded-lg cursor-pointer bg-bg-secondary/50 border-bg-elevated hover:border-primary hover:bg-bg-tertiary"
						onclick={() => handleStartWorkout()}
					>
						<div class="flex-1">
							<span class="block text-lg tracking-wide text-text-primary font-display">Custom Workout</span>
							<span class="block text-xs text-text-muted">Add exercises as you go</span>
						</div>
						<span class="text-xs tracking-widest uppercase text-text-secondary font-display">Start →</span>
					</button>
					</div>
				</div>
			{/if}

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
				<button class="flex items-center gap-4 p-6 text-left transition-all duration-200 border rounded-lg cursor-pointer bg-bg-secondary border-bg-tertiary hover:border-primary hover:bg-bg-tertiary" onclick={handleOpenHistory}>
					<span class="text-3xl">📊</span>
					<div>
						<span class="block text-lg tracking-wide text-text-primary font-display">Workout History</span>
						<span class="block text-xs text-text-muted">View and edit past sessions</span>
					</div>
				</button>
				<button class="flex items-center gap-4 p-6 text-left transition-all duration-200 border rounded-lg cursor-pointer bg-bg-secondary border-bg-tertiary hover:border-primary hover:bg-bg-tertiary" onclick={() => currentView = 'bands'}>
					<span class="text-3xl">🪢</span>
					<div>
						<span class="block text-lg tracking-wide text-text-primary font-display">Manage Bands</span>
						<span class="block text-xs text-text-muted">Add or remove resistance bands</span>
					</div>
				</button>
				<button class="flex items-center gap-4 p-6 text-left transition-all duration-200 border rounded-lg cursor-pointer bg-bg-secondary border-bg-tertiary hover:border-primary hover:bg-bg-tertiary" onclick={() => currentView = 'exercises'}>
					<span class="text-3xl">🏋🏻</span>
					<div>
						<span class="block text-lg tracking-wide text-text-primary font-display">Manage Exercises</span>
						<span class="block text-xs text-text-muted">Customize your exercise list</span>
					</div>
				</button>
			</div>
		</div>

	{:else if currentView === 'workout'}
		<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
			<Header title={isEditingSession ? "Edit Workout" : "Workout"} showBack onback={() => {
				if (isEditingSession) {
					isEditingSession = false;
					workout.saveEditedSession();
				}
				currentView = 'home';
			}} />

			<!-- Date -->
			{#if workoutState.currentSession}
				<div class="flex items-baseline gap-3">
					<span class="text-xs tracking-widest uppercase text-text-muted">Date</span>
					<span class="text-2xl font-display text-text-primary">{formatDate(workoutState.currentSession.startedAt)}</span>
				</div>
			{/if}

			<!-- Timer -->
			<div class="flex flex-col gap-2">
				<span class="text-xs tracking-widest uppercase text-text-muted">Timer</span>
				<WorkoutTimer />
			</div>

			<!-- Exercises List -->
			<div class="flex flex-col gap-2">
				<span class="text-xs tracking-widest uppercase text-text-muted">Exercises</span>
				<div class="overflow-hidden border rounded-lg bg-bg-secondary border-bg-tertiary">
					{#each workoutState.suggestedExercises as exercise (exercise.id)}
						<LogExerciseDialog
							{exercise}
							bands={workoutState.bands}
							currentLog={getExerciseLog(exercise.id)}
							onlog={(bandIds, fullReps, partialReps, notes) => handleLogExercise(exercise.id, bandIds, fullReps, partialReps, notes)}
						/>
					{/each}
					
					<!-- Add Exercise Button -->
					<div class="p-2">
						<AddExerciseDialog 
							exercises={workoutState.exercises}
							excludeIds={workoutState.suggestedExercises.map(e => e.id)}
							onselect={(exercise: Exercise) => workout.addSuggestedExercise(exercise)}
						/>
					</div>
				</div>
			</div>

			<!-- Session Notes -->
			<div class="flex flex-col gap-2">
				<label for="session-notes" class="text-xs tracking-widest uppercase text-text-muted">Session Notes</label>
				<textarea
					id="session-notes"
					placeholder="How was your workout? Any notes for next time..."
					bind:value={sessionNotes}
					rows="2"
					class="w-full px-4 py-3 text-sm border rounded-lg resize-none bg-bg-secondary border-bg-tertiary text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
				></textarea>
			</div>

			<!-- Save/End Button -->
			<button class="w-full py-4 mt-4 text-lg font-semibold btn-primary" onclick={handleEndWorkout}>
				Save Workout
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
						<div class="shrink-0 w-6 h-6 rounded-sm" style:background={band.color || '#666'}></div>
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

	{:else if currentView === 'history'}
		<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
			<Header title="History" showBack onback={() => currentView = 'home'} />

			{#if sessionHistory.length === 0}
				<div class="flex flex-col items-center gap-4 py-12 text-center">
					<span class="text-5xl opacity-50">📋</span>
					<div class="flex flex-col gap-1">
						<h3 class="text-lg tracking-wide uppercase font-display text-text-secondary">No Workouts Yet</h3>
						<p class="text-sm text-text-muted">Complete a workout to see it here</p>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					{#each sessionHistory as session, i (session.id)}
						<div 
							class="relative overflow-hidden border rounded-lg bg-bg-secondary border-bg-tertiary"
							transition:fly={{ y: 20, duration: 200, delay: i * 50 }}
						>
							<!-- Session Header -->
							<div class="flex items-center justify-between p-4 border-b border-bg-tertiary">
								<div class="flex flex-col gap-1">
									<div class="flex items-center gap-2">
										<span class="text-xl font-display text-primary">
											{formatDate(session.startedAt)}
										</span>
										{#if session.templateName}
											<span class="px-2 py-0.5 text-[0.65rem] uppercase tracking-wider rounded bg-bg-tertiary text-text-muted">
												{session.templateName}
											</span>
										{/if}
									</div>
									<span class="text-xs text-text-muted">
										{formatSessionDuration(session.startedAt, session.endedAt)}
									</span>
								</div>
								<button 
									class="flex items-center justify-center w-9 h-9 transition-all duration-200 border rounded-md cursor-pointer bg-bg-tertiary border-bg-elevated text-text-secondary hover:border-primary hover:text-primary"
									onclick={() => handleEditSession(session.id)}
									aria-label="Edit session"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</button>
							</div>

							<!-- Exercises List -->
							{#if session.logs.length > 0}
								<div class="flex flex-col divide-y divide-bg-tertiary">
									{#each session.logs as log (log.id)}
										<div class="flex flex-col gap-2 p-4">
											<div class="flex items-center justify-between">
												<span class="text-sm tracking-wide uppercase font-display text-text-primary">{log.exerciseName}</span>
												<div class="flex items-center gap-2">
													<span class="text-lg font-display text-primary">{log.fullReps}</span>
													{#if log.partialReps > 0}
														<span class="text-sm font-display text-text-muted">+</span>
														<span class="text-lg font-display text-secondary">{log.partialReps}</span>
													{/if}
													<span class="text-[0.65rem] uppercase tracking-wider text-text-muted">reps</span>
												</div>
											</div>
											{#if log.bands.length > 0}
												<div class="flex flex-wrap items-center gap-1">
													{#each log.bands as band (band.id)}
														<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] rounded-full bg-bg-tertiary text-text-secondary">
															<span class="w-1.5 h-1.5 rounded-full" style:background-color={band.color || '#666'}></span>
															{band.name}
														</span>
													{/each}
													<span class="ml-auto text-[0.65rem] text-text-muted">
														{log.bands.reduce((sum, b) => sum + b.resistance, 0)} lbs
													</span>
												</div>
											{/if}
											{#if log.notes}
												<p class="text-xs italic text-text-muted">"{log.notes}"</p>
											{/if}
										</div>
									{/each}
								</div>
							{/if}

							<!-- Session Notes -->
							{#if session.notes}
								<div class="px-4 py-3 border-t border-bg-tertiary bg-bg-tertiary/30">
									<p class="text-xs text-text-secondary">
										<span class="mr-1 text-text-muted">📝</span> {session.notes}
									</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
{/if}
