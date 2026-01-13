<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import * as workout from '$lib/stores/workout.svelte';
	import { db } from '$lib/db/client';
	import { browser, version } from '$app/environment';

	let workoutState = workout.getState();

	async function setWeightUnit(unit: 'lbs' | 'kg') {
		await workout.updateWeightUnit(unit);
	}

	async function exportData() {
		if (!browser || !db) return;

		const data = {
			bands: await db.query.bands.findMany(),
			exercises: await db.query.exercises.findMany(),
			settings: await db.query.settings.findMany(),
			workoutTemplates: await db.query.workoutTemplates.findMany({
				with: {
					workoutTemplateExercises: true
				}
			}),
			workoutSessions: await db.query.workoutSessions.findMany({
				with: {
					loggedExercises: {
						with: {
							loggedExerciseBands: true
						}
					}
				}
			}),
			exportedAt: new Date().toISOString()
		};

		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = `gummi-bands-export-${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<div class="flex flex-col gap-6 animate-fade-in">
	<Header title="Settings" showBack />

	<div class="flex flex-col gap-4">
		<div class="card flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<h3 class="text-lg font-medium text-text-primary">Weight Units</h3>
				<p class="text-sm text-text-muted">Choose your preferred weight unit for all displays.</p>
			</div>

			<div class="flex gap-2 p-1 bg-bg-tertiary rounded-lg">
				<button
					class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 {workoutState.weightUnit === 'lbs'
						? 'bg-bg-elevated text-text-primary shadow-sm'
						: 'text-text-muted hover:text-text-secondary'}"
					onclick={() => setWeightUnit('lbs')}
				>
					Pounds (lbs)
				</button>
				<button
					class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 {workoutState.weightUnit === 'kg'
						? 'bg-bg-elevated text-text-primary shadow-sm'
						: 'text-text-muted hover:text-text-secondary'}"
					onclick={() => setWeightUnit('kg')}
				>
					Kilograms (kg)
				</button>
			</div>
		</div>

		<div class="card flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<h3 class="text-lg font-medium text-text-primary">Data Management</h3>
				<p class="text-sm text-text-muted">Export your data for backup or analysis.</p>
			</div>

			<button
				class="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-bg-tertiary text-text-primary font-medium hover:bg-bg-elevated transition-colors"
				onclick={exportData}
			>
				<i class="icon-[ph--download-simple] size-5"></i>
				Export All Data (JSON)
			</button>
		</div>

		<div class="card flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<h3 class="text-lg font-medium text-text-primary">About</h3>
				<p class="text-sm text-text-muted">Gummi Bands {version}</p>
			</div>
			<div class="text-xs text-text-muted italic">
				Keep pushing your limits.
			</div>
		</div>
	</div>
</div>
