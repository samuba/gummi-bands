<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		open: boolean;
		title?: string;
		description?: string;
		confirmText?: string;
		cancelText?: string;
		variant?: 'danger' | 'warning' | 'default';
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		open = $bindable(false),
		title = 'Are you sure?',
		description = 'This action cannot be undone.',
		confirmText = 'Delete',
		cancelText = 'Cancel',
		variant = 'danger',
		onconfirm,
		oncancel
	}: Props = $props();

	function handleConfirm() {
		onconfirm();
		open = false;
	}

	function handleCancel() {
		oncancel();
		open = false;
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
			transition={fade}
			transitionConfig={{ duration: 150 }}
		/>
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-bg-elevated bg-bg-secondary p-6 shadow-2xl focus:outline-none"
			transition={scale}
			transitionConfig={{ duration: 150, start: 0.95 }}
		>
			<!-- Icon -->
			<div class="flex justify-center mb-4">
				{#if variant === 'danger'}
					<div class="flex items-center justify-center w-12 h-12 rounded-full bg-error/20">
						<i class="icon-[ph--warning-circle] size-6 text-error"></i>
					</div>
				{:else if variant === 'warning'}
					<div class="flex items-center justify-center w-12 h-12 rounded-full bg-warning/20">
						<i class="icon-[ph--warning] size-6 text-warning"></i>
					</div>
				{:else}
					<div class="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20">
						<i class="icon-[ph--question] size-6 text-primary"></i>
					</div>
				{/if}
			</div>

			<Dialog.Title class="text-lg font-semibold tracking-wide text-center text-text-primary font-display">
				{title}
			</Dialog.Title>
			<Dialog.Description class="mt-2 text-sm text-center text-text-muted">
				{description}
			</Dialog.Description>

			<div class="flex gap-3 mt-6">
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 border rounded-lg cursor-pointer bg-bg-tertiary border-bg-elevated text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
					onclick={handleCancel}
				>
					{cancelText}
				</button>
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg cursor-pointer {variant === 'danger' ? 'bg-error hover:bg-error/80' : variant === 'warning' ? 'bg-warning hover:bg-warning/80 text-bg-primary' : 'bg-primary hover:bg-primary-dark'} text-white"
					onclick={handleConfirm}
				>
					{confirmText}
				</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

