<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { db } from '$lib/db/app/client';
	import { browser, version } from '$app/environment';
	import { settings } from '$lib/stores/settings.svelte';
	import { wakeLock } from '$lib/stores/wakeLock.svelte';
	import { dbRepl } from '$lib/components/DbRepl.svelte';
	import { authClient, sessionStore } from '$lib/auth-client.svelte';

	async function handleSignOut() {
		await authClient.signOut();
	}

	async function setWeightUnit(unit: 'lbs' | 'kg') {
		await settings.updateWeightUnit(unit);
	}

	async function toggleKeepScreenAwake() {
		await settings.updateKeepScreenAwake(!settings.keepScreenAwake);
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

	const buildDate = new Intl.DateTimeFormat(navigator.language, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	}).format(new Date(Number.parseInt(version)));
</script>

<div class="flex flex-col gap-6 animate-in fade-in">
	<Header title="Settings" showBack />

	<div class="flex flex-col gap-4">
		<div class="card flex flex-col gap-4 px-6 py-5">
			<div class="flex flex-col gap-1">
				<h3 class="text-lg font-medium text-text-primary">Weight Units</h3>
				<p class="text-sm text-text-muted">Choose your preferred weight unit for all displays.</p>
			</div>

			<div class="flex gap-2 p-1 bg-bg-tertiary rounded-lg">
				<button
					class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 {settings.weightUnit === 'lbs'
						? 'bg-bg-elevated text-text-primary shadow-sm'
						: 'text-text-muted hover:text-text-secondary'}"
					onclick={() => setWeightUnit('lbs')}
				>
					Pounds (lbs)
				</button>
				<button
					class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 {settings.weightUnit === 'kg'
						? 'bg-bg-elevated text-text-primary shadow-sm'
						: 'text-text-muted hover:text-text-secondary'}"
					onclick={() => setWeightUnit('kg')}
				>
					Kilograms (kg)
				</button>
			</div>
		</div>

		<div class="card flex flex-col gap-4 px-6 py-5">
			<div class="flex items-center justify-between">
				<div class="flex flex-col gap-1">
					<h3 class="text-lg font-medium text-text-primary">Keep Screen Awake</h3>
					<p class="text-sm text-text-muted">
						{#if wakeLock.isSupported}
							Prevent screen from sleeping when app is open.
						{:else}
							Not supported on this device.
						{/if}
					</p>
				</div>

				<button
					class="flex items-center h-7 w-12 rounded-full p-1 transition-colors duration-200 {settings.keepScreenAwake
						? 'bg-primary'
						: 'bg-bg-tertiary'}"
					onclick={toggleKeepScreenAwake}
					disabled={!wakeLock.isSupported}
					aria-label="Toggle keep screen awake"
				>
					<span
						class="size-5 rounded-full bg-white shadow-sm transition-transform duration-200 {settings.keepScreenAwake
							? 'translate-x-5'
							: 'translate-x-0'}"
					></span>
				</button>
			</div>
		</div>

		<div class="card flex flex-col gap-4 px-6 py-5">
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

		<button
			class="card flex flex-col gap-4 text-left cursor-pointer hover:bg-bg-elevated transition-colors px-6 py-5"
			onclick={() => dbRepl.registerClick()}
		>
			<div class="flex flex-col gap-1">
				<h3 class="text-lg font-medium text-text-primary">About</h3>
				<p class="text-sm text-text-muted">Gummi Bands build from {buildDate}</p>
			</div>
			<div class="text-xs text-text-muted italic">
				Keep pushing your limits.
			</div>
		</button>

		{#if $sessionStore.data}
			<div class="card flex flex-col gap-4 px-6 py-5">
				<div class="flex items-center gap-4">
					{#if $sessionStore.data.user.image}
						<img
							src={$sessionStore.data.user.image}
							alt={$sessionStore.data.user.name}
							class="w-12 h-12 rounded-full border-2 border-primary"
						/>
					{:else}
						<div
							class="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-display text-lg"
						>
							{$sessionStore.data.user.name?.charAt(0).toUpperCase() || 'U'}
						</div>
					{/if}
					<div class="flex flex-col gap-1">
						<h3 class="text-lg font-medium text-text-primary">{$sessionStore.data.user.name}</h3>
						<p class="text-sm text-text-muted">{$sessionStore.data.user.email}</p>
					</div>
				</div>

				<button
					class="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-bg-tertiary text-text-primary font-medium hover:bg-error/20 hover:text-error transition-colors"
					onclick={handleSignOut}
				>
					<i class="icon-[ph--sign-out] size-5"></i>
					Sign Out
				</button>
			</div>
		{/if}
	</div>
</div>
