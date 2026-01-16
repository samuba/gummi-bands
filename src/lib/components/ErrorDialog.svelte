<script lang="ts" module>
	export type ErrorDetails = {
		title: string;
		message: string;
		stack?: string;
		context?: string;
	};

	export type ErrorDialogContext = {
		show: (details: ErrorDetails) => void;
	};

	export const errorDialog: ErrorDialogContext = {
		show: null!
	};
</script>
<script lang="ts">
	import { Dialog } from './dialog';

	let open = $state(false);
	let errorTitle = $state('Error');
	let errorMessage = $state('');
	let errorStack = $state<string | undefined>(undefined);
	let errorContext = $state<string | undefined>(undefined);

	function showError(details: ErrorDetails) {
		errorTitle = details.title;
		errorMessage = details.message;
		errorStack = details.stack;
		errorContext = details.context;
		open = true;
	}

	function handleDismiss() {
		open = false;
	}

	errorDialog.show = showError;
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }}>
	<Dialog.Portal>
		<Dialog.Overlay class="z-[100]" />
		<Dialog.Content class="z-[100] max-w-lg max-h-[85vh] flex flex-col" interactOutsideBehavior="ignore">
			<!-- Icon -->
			<div class="flex justify-center mb-4">
				<div class="flex items-center justify-center w-12 h-12 rounded-full bg-error/20">
					<i class="icon-[ph--warning] size-6 text-error"></i>
				</div>
			</div>

			<Dialog.Title class="text-lg font-semibold tracking-wide text-center text-text-primary font-display">
				{errorTitle}
			</Dialog.Title>
			
			<div class="flex-1 mt-4 overflow-y-auto">
				<!-- Error Message -->
				<div class="p-3 rounded-lg bg-bg-tertiary">
					<p class="text-sm font-medium text-error break-words">{errorMessage}</p>
				</div>

				<!-- Context -->
				{#if errorContext}
					<div class="mt-3">
						<p class="text-xs font-medium text-text-muted mb-1">Context</p>
						<div class="p-3 rounded-lg bg-bg-tertiary">
							<pre class="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono">{errorContext}</pre>
						</div>
					</div>
				{/if}

				<!-- Stack Trace -->
				{#if errorStack}
					<div class="mt-3">
						<p class="text-xs font-medium text-text-muted mb-1">Stack Trace</p>
						<div class="p-3 rounded-lg bg-bg-tertiary max-h-48 overflow-y-auto">
							<pre class="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono">{errorStack}</pre>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex gap-3 mt-6">
				<button
					class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg cursor-pointer bg-error hover:bg-error/80 text-white"
					onclick={handleDismiss}
				>
					Dismiss
				</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
