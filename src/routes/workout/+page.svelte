<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import WorkoutTimer from '$lib/components/WorkoutTimer.svelte';
	import AddExerciseDialog from '$lib/components/AddExerciseDialog.svelte';
	import LogExerciseDialog from '$lib/components/LogExerciseDialog.svelte';
	import { workout } from '$lib/stores/workout.svelte';
	import type { Exercise } from '$lib/db/app/schema';
	import { resolve } from '$app/paths';
	import { confirmDialog } from '$lib/components/ConfirmDialog.svelte';

	let sessionNotes = $state('');
	let isEditingSession = $state(false);
	let loadedSessionKey = $state('');

	const editSessionId = $derived(page.url.searchParams.get('edit'));
	const templateId = $derived(page.url.searchParams.get('template'));
	const sessionKey = $derived(`${editSessionId ?? ''}:${templateId ?? ''}`);
	const returnUrl = $derived(
		page.url.searchParams.get('from') === 'home' ? '/' : isEditingSession ? '/history' : '/'
	);

	// Check for edit mode or start new session on initial load and client-side navigation.
	afterNavigate(() => {
		loadSession();
	});

	async function loadSession() {
		if (loadedSessionKey === sessionKey) return;
		loadedSessionKey = sessionKey;

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
		} else if (!workout.currentSession) {
			// Start new session
			await workout.startSession(templateId || undefined);
		}

		await workout.hydrateSuggestedExercisesFromPlanned();
	}

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
		if (!workout.currentSession) return;

		const confirmed = await confirmDialog.confirm({
			title: 'Delete Workout?',
			html: 'Are you sure you want to delete this workout session? This action cannot be undone.',
			confirmText: 'Delete',
			cancelText: 'Cancel',
			iconClass: 'icon-[ph--trash]'
		});

		if (confirmed) {
			await workout.deleteSession(workout.currentSession.id);
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
		const existingLog = workout.sessionLogs.find((log) => log.exerciseId === exerciseId);
		if (existingLog) {
			// Remove existing log first
			await workout.removeLoggedExercise(existingLog.id);
		}
		// Log the new data
		await workout.logExercise(exerciseId, bandIds, fullReps, partialReps, notes);
	}

	// Get current log for an exercise
	function getExerciseLog(exerciseId: string) {
		const log = workout.sessionLogs.find((l) => l.exerciseId === exerciseId);
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
		}).format(new Date(date));
	}
</script>

<div class="flex animate-in flex-col gap-6 fade-in">
	<Header title={isEditingSession ? 'Edit Workout' : 'Workout'} showBack backHref={returnUrl} />

	<!-- Date & Timer -->
	<div class="flex items-start justify-between">
		<div class="flex gap-8">
			{#if workout.currentSession}
				<div class="flex flex-col gap-1">
					<span class="text-xs tracking-widest text-text-muted uppercase">Date</span>
					<span class="font-display text-2xl text-text-primary"
						>{formatDate(workout.currentSession.startedAt)}</span
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
			{#each workout.suggestedExercises as exercise (exercise.id)}
				<LogExerciseDialog
					{exercise}
					bands={workout.allBands}
					currentLog={getExerciseLog(exercise.id)}
					onlog={(bandIds, fullReps, partialReps, notes) =>
						handleLogExercise(exercise.id, bandIds, fullReps, partialReps, notes)}
				/>
			{/each}

			<!-- Add Exercise Button -->
			<div class="p-2">
				<AddExerciseDialog
					exercises={workout.allExercises}
					excludeIds={workout.suggestedExercises.map((e) => e.id)}
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
	<div class="mt-4 flex flex-col gap-3">
		<button class="btn-primary w-full py-4 text-lg font-semibold" onclick={handleEndWorkout}>
			Save Workout
		</button>

		{#if isEditingSession}
			<button
				class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-bg-tertiary bg-bg-secondary py-3 text-sm font-medium text-error transition-all duration-200 hover:border-error hover:bg-bg-tertiary"
				onclick={handleDeleteSession}
			>
				<i class="icon-[ph--trash] size-5"></i>
				Delete Workout
			</button>
		{/if}
	</div>
</div>
