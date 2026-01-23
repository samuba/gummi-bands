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
	import { resolve } from '$app/paths';
	import { confirmDialog } from '$lib/components/ConfirmDialog.svelte';

	let workoutState = workout.getState();

	let sessionNotes = $state('');
	let isEditingSession = $state(false);

	const returnUrl = $derived($page.url.searchParams.get('from') === 'home' ? '/' : (isEditingSession ? '/history' : '/'));

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
				goto(resolve('/'));
			}
		} else if (!workoutState.currentSession) {
			// Start new session
			await workout.startSession(templateId || undefined);
		}
	});

	async function handleEndWorkout() {
		const wasEditing = isEditingSession;
		const destination = returnUrl;
		if (isEditingSession) {
			await workout.saveEditedSession(sessionNotes.trim() || undefined);
			isEditingSession = false;
		} else {
			await workout.endSession(sessionNotes.trim() || undefined);
		}
		sessionNotes = '';
		goto(resolve(destination));
	}

	async function handleDeleteSession() {
		if (!workoutState.currentSession) return;
		
		const confirmed = await confirmDialog.confirm({
			title: 'Delete Workout?',
			html: 'Are you sure you want to delete this workout session? This action cannot be undone.',
			confirmText: 'Delete',
			cancelText: 'Cancel',
			iconClass: 'icon-[ph--trash]'
		});

		if (confirmed) {
			await workout.deleteSession(workoutState.currentSession.id);
			goto(resolve('/history'));
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
		backHref={returnUrl}
	/>

	<!-- Date & Timer -->
	<div class="flex items-start justify-between">
		<div class="flex gap-8">
			{#if workoutState.currentSession}
				<div class="flex flex-col gap-1">
					<span class="text-xs tracking-widest text-text-muted uppercase">Date</span>
					<span class="font-display text-2xl text-text-primary"
						>{formatDate(workoutState.currentSession.startedAt)}</span
					>
				</div>
			{/if}
		</div>

		<div class="flex flex-col items-end gap-1">
			<span class="text-xs tracking-widest text-text-muted uppercase">Timer</span>
			<WorkoutTimer />
		</div>
	</div>

	<!-- Exercises List -->
	<div class="flex flex-col gap-2">
		<span class="text-xs tracking-widest text-text-muted uppercase">Exercises</span>
		<div class="card overflow-hidden p-0">
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
			class="resize-none"
		></textarea>
	</div>

	<!-- Action Buttons -->
	<div class="flex flex-col gap-3 mt-4">
		<button class="btn-primary w-full py-4 text-lg font-semibold" onclick={handleEndWorkout}>
			Save Workout
		</button>
		
		{#if isEditingSession}
			<button 
				class="w-full py-3 text-sm font-medium cursor-pointer text-error border border-bg-tertiary rounded-lg bg-bg-secondary hover:bg-bg-tertiary hover:border-error transition-all duration-200 flex items-center justify-center gap-2"
				onclick={handleDeleteSession}
			>
				<i class="icon-[ph--trash] size-5"></i>
				Delete Workout
			</button>
		{/if}
	</div>
</div>

