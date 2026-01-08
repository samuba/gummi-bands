<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Header from '$lib/components/Header.svelte';
	import WorkoutTimer from '$lib/components/WorkoutTimer.svelte';
	import AddExerciseDialog from '$lib/components/AddExerciseDialog.svelte';
	import LogExerciseDialog from '$lib/components/LogExerciseDialog.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import type { Exercise } from '$lib/db/schema';

	let workoutState = workout.getState();

	let sessionNotes = $state('');
	let isEditingSession = $state(false);

	// Check for edit mode or start new session
	onMount(async () => {
		const editSessionId = $page.url.searchParams.get('edit');
		const templateId = $page.url.searchParams.get('template');
		
		if (editSessionId) {
			// Edit existing session
			const session = await workout.editSession(editSessionId);
			if (session) {
				sessionNotes = session.notes || '';
				isEditingSession = true;
			} else {
				// Session not found, go home
				goto('/');
			}
		} else if (!workoutState.currentSession) {
			// Start new session
			await workout.startSession(templateId || undefined);
		}
	});

	async function handleEndWorkout() {
		const wasEditing = isEditingSession;
		if (isEditingSession) {
			await workout.saveEditedSession(sessionNotes.trim() || undefined);
			isEditingSession = false;
		} else {
			await workout.endSession(sessionNotes.trim() || undefined);
		}
		sessionNotes = '';
		goto(wasEditing ? '/history' : '/');
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
		return new Intl.DateTimeFormat(navigator.language, {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric'
		})
			.format(new Date(date))
	}
</script>

<div class="flex flex-col gap-6 animate-fade-in">
	<Header
		title={isEditingSession ? 'Edit Workout' : 'Workout'}
		showBack
		backHref={isEditingSession ? '/history' : '/'}
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

