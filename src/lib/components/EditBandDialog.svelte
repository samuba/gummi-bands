<script lang="ts" module>
	export type EditBandOptions = {
		id: string;
		name: string;
		resistance: number;
		color: string;
	};

	export type EditBandResult = {
		action: 'save' | 'delete';
		name: string;
		resistance: number;
		color: string;
	} | null;

	export type EditBandContext = {
		open: (options: EditBandOptions) => Promise<EditBandResult>;
	};

	export const editBandDialog: EditBandContext = {
		open: null!
	};
</script>

<script lang="ts">
	import { Dialog } from './dialog';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { confirmDialog } from './ConfirmDialog.svelte';
	import { settings } from '$lib/stores/settings.svelte';

	const open = $derived(page.state.editBandOpen === true);
	let bandId = $state('');
	let bandName = $state('');
	let originalName = $state('');
	let bandResistance = $state(10);
	let bandColor = $state('#FF4444');

	let resolvePromise: ((value: EditBandResult) => void) | null = null;

	function openDialog(options: EditBandOptions) {
		bandId = options.id;
		bandName = options.name;
		originalName = options.name;
		bandResistance = options.resistance;
		bandColor = options.color;
		
		pushState('', { ...page.state, editBandOpen: true });

		return new Promise<EditBandResult>((resolve) => {
			resolvePromise = resolve;
		});
	}

	function handleSave() {
		resolvePromise?.({
			action: 'save',
			name: bandName.trim(),
			resistance: bandResistance,
			color: bandColor
		});
		resolvePromise = null;
		handleOpenChange(false);
	}

	async function handleDelete() {
		const confirmed = await confirmDialog.confirm({
			title: 'Delete Band?',
			html: `Are you sure you want to delete "<strong>${originalName}</strong>"?`,
			iconClass: 'icon-[ph--trash]',
			confirmText: 'Delete',
			cancelText: 'Cancel'
		});

		if (confirmed) {
			resolvePromise?.({
				action: 'delete',
				name: bandName.trim(),
				resistance: bandResistance,
				color: bandColor
			});
			resolvePromise = null;
			handleOpenChange(false);
		}
	}

	function handleCancel() {
		resolvePromise?.(null);
		resolvePromise = null;
		handleOpenChange(false);
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen) {
			pushState('', { ...page.state, editBandOpen: true });
		} else {
			if (page.state.editBandOpen) {
				history.back();
			}
		}
	}

	editBandDialog.open = openDialog;

	const isValid = $derived(bandName.trim().length > 0 && bandResistance > 0);
</script>

<Dialog.Root open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) handleCancel(); }}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="max-w-sm" interactOutsideBehavior="ignore">
			<Dialog.Title class="text-lg font-semibold tracking-wide text-text-primary font-display">
				Edit Band
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-sm text-text-muted">
				Update the band's name, resistance, and color.
			</Dialog.Description>

			<div class="mt-5 flex flex-col gap-4">
				<div class="flex flex-col gap-1">
					<label class="text-xs tracking-wide text-text-muted uppercase" for="edit-band-name">
						Name
					</label>
					<input
						id="edit-band-name"
						type="text"
						placeholder="Band name"
						bind:value={bandName}
						class="w-full px-4 py-3 text-sm transition-colors duration-200 border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
					/>
				</div>

				<div class="grid grid-cols-[1fr_auto] gap-4">
					<div class="flex flex-col gap-1">
						<label class="text-xs tracking-wide text-text-muted uppercase" for="edit-band-resistance">
							Resistance ({settings.weightUnit})
						</label>
						<input
							id="edit-band-resistance"
							type="number"
							min="1"
							max="200"
							bind:value={bandResistance}
							class="w-full px-4 py-3 text-sm transition-colors duration-200 border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs tracking-wide text-text-muted uppercase" for="edit-band-color">
							Color
						</label>
						<input
							id="edit-band-color"
							type="color"
							class="h-[46px] w-[60px] cursor-pointer rounded-lg border-2 border-bg-elevated bg-bg-tertiary p-1"
							bind:value={bandColor}
						/>
					</div>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 border rounded-lg cursor-pointer bg-bg-tertiary border-bg-elevated text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
					onclick={handleCancel}
				>
					Cancel
				</button>
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg cursor-pointer bg-primary hover:bg-primary/80 text-white disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleSave}
					disabled={!isValid}
				>
					Save
				</button>
			</div>

			<button
				class="flex items-center justify-center gap-2 w-full mt-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg cursor-pointer text-error hover:bg-error/10"
				onclick={handleDelete}
			>
				<i class="icon-[ph--trash] size-4"></i>
				Delete Band
			</button>

			<Dialog.Close
				class="absolute p-1 transition-colors rounded-md top-4 right-4 text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
			>
				<i class="icon-[ph--x] size-5"></i>
				<span class="sr-only">Close</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

