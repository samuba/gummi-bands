<script lang="ts" module>
	export type ConfirmOptions = {
		title: string;
		html: string;
		iconClass?: string;
		confirmText?: string;
		cancelText?: string;
	};

	export type ConfirmContext = {
		confirm: (options: ConfirmOptions) => Promise<boolean>;
	};

	export const confirmDialog: ConfirmContext = {
		confirm: null!
	};
</script>
<script lang="ts">
	import { Dialog } from 'bits-ui';

	let dialogOpen = $state(false);
	let dialogTitle = $state('Are you sure?');
	let dialogHtml = $state('This action cannot be undone.');
	let dialogIconClass = $state<string | undefined>(undefined);
	let dialogConfirmText = $state('Confirm');
	let dialogCancelText = $state('Cancel');

	let resolvePromise: ((value: boolean) => void) | null = null;

	function openConfirmDialog(options: ConfirmOptions) {
		dialogTitle = options.title;
		dialogHtml = options.html;
		dialogIconClass = options.iconClass;
		dialogConfirmText = options.confirmText ?? 'Confirm';
		dialogCancelText = options.cancelText ?? 'Cancel';
		dialogOpen = true;

		return new Promise<boolean>((resolve) => {
			resolvePromise = resolve;
		});
	}

	function handleConfirm() {
		resolvePromise?.(true);
		resolvePromise = null;
		dialogOpen = false;
	}

	function handleCancel() {
		resolvePromise?.(false);
		resolvePromise = null;
		dialogOpen = false;
	}

	confirmDialog.confirm = openConfirmDialog;
</script>

<Dialog.Root bind:open={dialogOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
		/>
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-[60] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-bg-elevated bg-bg-secondary p-6 shadow-2xl focus:outline-none"
		>
			<!-- Icon -->
			{#if dialogIconClass}
				<div class="flex justify-center mb-4">
					<div class="flex items-center justify-center w-12 h-12 rounded-full bg-error/20">
						<i class="{dialogIconClass} size-6 text-error"></i>
					</div>
				</div>
			{/if}

			<Dialog.Title class="text-lg font-semibold tracking-wide text-center text-text-primary font-display">
				{dialogTitle}
			</Dialog.Title>
			<Dialog.Description class="mt-2 text-sm text-center text-text-muted">
				{@html dialogHtml}
			</Dialog.Description>

			<div class="flex gap-3 mt-6">
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 border rounded-lg cursor-pointer bg-bg-tertiary border-bg-elevated text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
					onclick={handleCancel}
				>
					{dialogCancelText}
				</button>
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg cursor-pointer bg-error hover:bg-error/80 text-white"
					onclick={handleConfirm}
				>
					{dialogConfirmText}
				</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
