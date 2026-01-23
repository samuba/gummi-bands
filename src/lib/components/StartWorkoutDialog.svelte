<script lang="ts" module>
	export type StartWorkoutResult = {
		templateId?: string;
	} | null;

	export type StartWorkoutContext = {
		open: () => Promise<StartWorkoutResult>;
	};

	export const startWorkoutDialog: StartWorkoutContext = {
		open: null!
	};
</script>

<script lang="ts">
	import { Dialog } from './dialog';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { workout } from '$lib/stores/workout.svelte';

	const open = $derived(page.state.startWorkoutOpen === true);
	let resolvePromise: ((value: StartWorkoutResult) => void) | null = null;
	let templateLastUsed: Awaited<ReturnType<typeof workout.getTemplateLastUsedDates>> = $state([]);

	// Load last used dates when dialog opens
	$effect(() => {
		if (open) {
			workout.getTemplateLastUsedDates().then(x => templateLastUsed = x);
		}
	});

	function formatDaysAgo(date: Date | null): string {
		console.log("date:",  );
		if (!date) return 'Never used';

		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return '1 day ago';
		return `${diffDays} days ago`;
	}

	function openDialog() {
		pushState('', { ...page.state, startWorkoutOpen: true });

		return new Promise<StartWorkoutResult>((resolve) => {
			resolvePromise = resolve;
		});
	}

	function handleSelectTemplate(templateId?: string) {
		resolvePromise?.({ templateId });
		resolvePromise = null;
		handleOpenChange(false);
	}

	function handleCancel() {
		resolvePromise?.(null);
		resolvePromise = null;
		handleOpenChange(false);
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen) {
			pushState('', { ...page.state, startWorkoutOpen: true });
		} else {
			if (page.state.startWorkoutOpen) {
				history.back();
			}
		}
	}

	startWorkoutDialog.open = openDialog;
</script>

<Dialog.Root open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) handleCancel(); }}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="max-w-md flex flex-col" interactOutsideBehavior="ignore">
			<Dialog.Title class="text-lg font-semibold tracking-wide text-text-primary font-display shrink-0">
				Start Workout
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-sm text-text-muted shrink-0">
				Choose a workout template or start a custom session
			</Dialog.Description>

			<div class="mt-5 flex flex-col gap-3 min-h-0 overflow-y-auto flex-1">
				{#if workout.allTemplates.length > 0}
					{#each workout.allTemplates as template (template.id)}
						<button
							class="group flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-bg-tertiary bg-bg-secondary p-4 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
							onclick={() => handleSelectTemplate(template.id)}
						>
							<div class="flex items-center justify-between">
								<span class="font-display text-base tracking-wide text-text-primary group-hover:text-primary">
									{template.name}
								</span>
								<i class="icon-[ph--arrow-right] size-5 text-primary"></i>
							</div>
							<div class="flex items-center gap-2 text-xs text-text-muted">
								<i class="icon-[ph--clock] size-4"></i>
								<span>{formatDaysAgo(templateLastUsed.find(x => x[0] === template.id)?.[1] ?? null)}</span>
							</div>
						</button>
					{/each}
				{/if}

				<button
					class="flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-dashed border-bg-elevated bg-bg-secondary/50 p-4 text-left transition-all duration-200 hover:border-primary hover:bg-bg-tertiary"
					onclick={() => handleSelectTemplate(undefined)}
				>
					<div class="flex items-center justify-between">
						<span class="font-display text-base tracking-wide text-text-primary">
							Custom Workout
						</span>
						<i class="icon-[ph--arrow-right] size-5 text-text-secondary"></i>
					</div>
					<span class="text-xs text-text-muted">Add exercises as you go</span>
				</button>
			</div>

			<div class="flex gap-3 mt-6 shrink-0">
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 border rounded-lg cursor-pointer bg-bg-tertiary border-bg-elevated text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
					onclick={handleCancel}
				>
					Cancel
				</button>
			</div>

			<Dialog.Close
				class="absolute p-1 transition-colors rounded-md top-4 right-4 text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
			>
				<i class="icon-[ph--x] size-5"></i>
				<span class="sr-only">Close</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
