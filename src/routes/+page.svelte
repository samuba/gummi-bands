<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import Header from '$lib/components/Header.svelte';
	import WorkoutTimer from '$lib/components/WorkoutTimer.svelte';
	import AddExerciseDialog from '$lib/components/AddExerciseDialog.svelte';
	import LogExerciseDialog from '$lib/components/LogExerciseDialog.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import type { Exercise, Band } from '$lib/db/schema';
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
	let loadingError = $state<Error | null>(null);

	// History state
	let sessionHistory = $state<DetailedSession[]>([]);
	let isEditingSession = $state(false);

	// Confirmation dialog state
	let confirmDialogOpen = $state(false);
	let pendingDeleteType = $state<'band' | 'exercise' | null>(null);
	let pendingDeleteItem = $state<Band | Exercise | null>(null);

	onMount(async () => {
		try {
			await workout.initialize();
		} catch (error) {
			console.error(error);

			isLoading = false;
		}
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

	async function handleLogExercise(
		exerciseId: string,
		bandIds: string[],
		fullReps: number,
		partialReps: number,
		notes?: string
	) {
		// Check if there's already a log for this exercise in current session
		const existingLog = workoutState.sessionLogs.find((log) => log.exerciseId === exerciseId);
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
		const log = workoutState.sessionLogs.find((l) => l.exerciseId === exerciseId);
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
		})
			.format(new Date(date))
			.replace(/\//g, '.');
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

	// Confirm delete handlers
	function requestDeleteBand(band: Band) {
		pendingDeleteType = 'band';
		pendingDeleteItem = band;
		confirmDialogOpen = true;
	}

	function requestDeleteExercise(exercise: Exercise) {
		pendingDeleteType = 'exercise';
		pendingDeleteItem = exercise;
		confirmDialogOpen = true;
	}

	async function handleConfirmDelete() {
		if (!pendingDeleteItem || !pendingDeleteType) return;

		if (pendingDeleteType === 'band') {
			await workout.deleteBand(pendingDeleteItem.id);
		} else if (pendingDeleteType === 'exercise') {
			await workout.deleteExercise(pendingDeleteItem.id);
		}

		pendingDeleteType = null;
		pendingDeleteItem = null;
	}

	function handleCancelDelete() {
		pendingDeleteType = null;
		pendingDeleteItem = null;
	}

	// Get confirmation dialog text based on pending delete type
	function getConfirmDialogTitle(): string {
		if (pendingDeleteType === 'band') return 'Delete Band?';
		if (pendingDeleteType === 'exercise') return 'Delete Exercise?';
		return 'Delete Item?';
	}

	function getConfirmDialogDescription(): string {
		if (!pendingDeleteItem) return 'This action cannot be undone.';
		if (pendingDeleteType === 'band') {
			return `Are you sure you want to delete "${pendingDeleteItem.name}"? This will remove it from your available bands.`;
		}
		if (pendingDeleteType === 'exercise') {
			return `Are you sure you want to delete "${pendingDeleteItem.name}"? This will remove it from your exercise list.`;
		}
		return 'This action cannot be undone.';
	}
</script>

{#if isLoading}
	<div
		class="flex min-h-[80vh] flex-col items-center justify-center gap-6"
		in:fade={{ duration: 200 }}
	>
		{#if loadingError}
			<div class="flex flex-col items-center justify-center gap-6">
				<i class="icon-[ph--warning] text-5xl text-error"></i>
				<p class="text-sm text-text-secondary">
					An error occurred while loading your workouts. Please try again.
				</p>
			</div>
		{:else}
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-bg-tertiary border-t-primary"
			></div>
			<p class="text-sm text-text-secondary">Loading your workouts...</p>
		{/if}
	</div>
{:else if currentView === 'home'}
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
			<button
				class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
				onclick={handleOpenHistory}
			>
				<i class="icon-[ph--chart-line] text-3xl text-primary"></i>
				<div>
					<span class="block font-display text-lg tracking-wide text-text-primary"
						>Workout History</span
					>
					<span class="block text-xs text-text-muted">View and edit past sessions</span>
				</div>
			</button>
			<button
				class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
				onclick={() => (currentView = 'bands')}
			>
				<i class="icon-[ph--infinity] text-3xl text-primary"></i>
				<div>
					<span class="block font-display text-lg tracking-wide text-text-primary"
						>Manage Bands</span
					>
					<span class="block text-xs text-text-muted">Add or remove resistance bands</span>
				</div>
			</button>
			<button
				class="flex cursor-pointer items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary p-6 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
				onclick={() => (currentView = 'exercises')}
			>
				<i class="icon-[ph--barbell] text-3xl text-primary"></i>
				<div>
					<span class="block font-display text-lg tracking-wide text-text-primary"
						>Manage Exercises</span
					>
					<span class="block text-xs text-text-muted">Customize your exercise list</span>
				</div>
			</button>
		</div>
	</div>
{:else if currentView === 'workout'}
	<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
		<Header
			title={isEditingSession ? 'Edit Workout' : 'Workout'}
			showBack
			onback={() => {
				if (isEditingSession) {
					isEditingSession = false;
					workout.saveEditedSession();
				}
				currentView = 'home';
			}}
		/>

		<!-- Date -->
		{#if workoutState.currentSession}
			<div class="flex items-baseline gap-3">
				<span class="text-xs tracking-widest text-text-muted uppercase">Date</span>
				<span class="font-display text-2xl text-text-primary"
					>{formatDate(workoutState.currentSession.startedAt)}</span
				>
			</div>
		{/if}

		<!-- Timer -->
		<div class="flex flex-col gap-2">
			<span class="text-xs tracking-widest text-text-muted uppercase">Timer</span>
			<WorkoutTimer />
		</div>

		<!-- Exercises List -->
		<div class="flex flex-col gap-2">
			<span class="text-xs tracking-widest text-text-muted uppercase">Exercises</span>
			<div class="overflow-hidden rounded-lg border border-bg-tertiary bg-bg-secondary">
				{#each workoutState.suggestedExercises as exercise (exercise.id)}
					<LogExerciseDialog
						{exercise}
						bands={workoutState.bands}
						currentLog={getExerciseLog(exercise.id)}
						onlog={(bandIds, fullReps, partialReps, notes) =>
							handleLogExercise(exercise.id, bandIds, fullReps, partialReps, notes)}
					/>
				{/each}

				<!-- Add Exercise Button -->
				<div class="p-2">
					<AddExerciseDialog
						exercises={workoutState.exercises}
						excludeIds={workoutState.suggestedExercises.map((e) => e.id)}
						onselect={(exercise: Exercise) => workout.addSuggestedExercise(exercise)}
					/>
				</div>
			</div>
		</div>

		<!-- Session Notes -->
		<div class="flex flex-col gap-2">
			<label for="session-notes" class="text-xs tracking-widest text-text-muted uppercase"
				>Session Notes</label
			>
			<textarea
				id="session-notes"
				placeholder="How was your workout? Any notes for next time..."
				bind:value={sessionNotes}
				rows="2"
				class="w-full resize-none rounded-lg border border-bg-tertiary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
			></textarea>
		</div>

		<!-- Save/End Button -->
		<button class="btn-primary mt-4 w-full py-4 text-lg font-semibold" onclick={handleEndWorkout}>
			Save Workout
		</button>
	</div>
{:else if currentView === 'bands'}
	<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
		<Header title="Bands" showBack onback={() => (currentView = 'home')} />

		<div class="card flex flex-col gap-4">
			<h3 class="text-base font-medium text-text-secondary">Add New Band</h3>
			<div class="flex gap-4">
				<input type="text" placeholder="Band name (e.g., Red - Light)" bind:value={newBandName} />
			</div>
			<div class="grid grid-cols-[1fr_auto] gap-4">
				<div class="flex flex-col gap-1">
					<label class="text-xs tracking-wide text-text-muted uppercase" for="resistance"
						>Resistance (lbs)</label
					>
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
			{#each workoutState.bands as band (band.id)}
				<div
					class="flex items-center gap-4 rounded-md border border-bg-tertiary bg-bg-secondary p-4"
					transition:slide={{ duration: 150 }}
				>
					<div class="h-6 w-6 shrink-0 rounded-sm" style:background={band.color || '#666'}></div>
					<div class="flex flex-1 flex-col gap-0.5">
						<span class="text-sm text-text-primary">{band.name}</span>
						<span class="text-xs text-text-muted">{band.resistance} lbs</span>
					</div>
					<button
						class="btn-ghost"
						onclick={() => requestDeleteBand(band)}
						aria-label="Delete {band.name}"
					>
						<i class="icon-[ph--trash] size-5"></i>
					</button>
				</div>
			{/each}
		</div>
	</div>
{:else if currentView === 'exercises'}
	<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
		<Header title="Exercises" showBack onback={() => (currentView = 'home')} />

		<div class="card flex flex-col gap-4">
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
				<div
					class="flex items-center gap-4 rounded-md border border-bg-tertiary bg-bg-secondary p-4"
					transition:slide={{ duration: 150 }}
				>
					<i class="icon-[ph--barbell] text-xl text-text-secondary"></i>
					<div class="flex flex-1 flex-col gap-0.5">
						<span class="text-sm text-text-primary">{exercise.name}</span>
					</div>
					<button
						class="btn-ghost"
						onclick={() => requestDeleteExercise(exercise)}
						aria-label="Delete {exercise.name}"
					>
						<i class="icon-[ph--trash] size-5"></i>
					</button>
				</div>
			{/each}
		</div>
	</div>
{:else if currentView === 'history'}
	<div class="flex flex-col gap-6" in:fly={{ x: 20, duration: 200 }}>
		<Header title="History" showBack onback={() => (currentView = 'home')} />

		{#if sessionHistory.length === 0}
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
				{#each sessionHistory as session, i (session.id)}
					<div
						class="relative overflow-hidden rounded-lg border border-bg-tertiary bg-bg-secondary"
						transition:fly={{ y: 20, duration: 200, delay: i * 50 }}
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
								onclick={() => handleEditSession(session.id)}
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
									<div class="flex flex-col gap-2 p-4">
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
												<span class="text-[0.65rem] tracking-wider text-text-muted uppercase"
													>reps</span
												>
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
													{log.bands.reduce((sum, b) => sum + b.resistance, 0)} lbs
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
				{/each}
			</div>
		{/if}
	</div>
{/if}

<!-- Confirmation Dialog -->
<ConfirmDialog
	bind:open={confirmDialogOpen}
	title={getConfirmDialogTitle()}
	description={getConfirmDialogDescription()}
	confirmText="Delete"
	cancelText="Cancel"
	variant="danger"
	onconfirm={handleConfirmDelete}
	oncancel={handleCancelDelete}
/>
