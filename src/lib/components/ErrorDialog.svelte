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

	let errorQueue = $state<ErrorDetails[]>([]);
	
	const currentError = $derived(errorQueue[0]);
	const open = $derived(errorQueue.length > 0);
	const remainingCount = $derived(errorQueue.length);

	function showError(details: ErrorDetails) {
		errorQueue.push(details);
	}

	function handleDismiss() {
		errorQueue.shift();
	}

	function handleDismissAll() {
		errorQueue = [];
	}

	errorDialog.show = showError;
</script>

<Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }}>
	<Dialog.Portal>
		<Dialog.Overlay class="z-100" />
		<Dialog.Content class="z-100 max-w-lg flex flex-col" interactOutsideBehavior="ignore">
			{#if currentError}
				<!-- Icon -->
				<div class="flex justify-center mb-4 shrink-0">
					<div class="flex items-center justify-center w-12 h-12 rounded-full bg-error/20">
						<i class="icon-[ph--warning] size-6 text-error"></i>
					</div>
				</div>

				<Dialog.Title class="text-lg font-semibold tracking-wide text-center text-text-primary font-display shrink-0">
					{currentError.title}
				</Dialog.Title>

				<!-- Error count badge -->
				{#if remainingCount > 1}
					<p class="text-xs text-center text-text-muted mt-1 shrink-0">
						{remainingCount} errors remaining
					</p>
				{/if}
				
				<div class="flex-1 mt-4 overflow-y-auto min-h-0">
					<!-- Error Message -->
					<div class="p-3 rounded-lg bg-bg-tertiary">
						<p class="text-sm font-medium text-error break-words">{currentError.message}</p>
					</div>

					<!-- Context -->
					{#if currentError.context}
						<div class="mt-3">
							<p class="text-xs font-medium text-text-muted mb-1">Context</p>
							<div class="p-3 rounded-lg bg-bg-tertiary">
								<pre class="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono">{currentError.context}</pre>
							</div>
						</div>
					{/if}

					<!-- Stack Trace -->
					{#if currentError.stack}
						<div class="mt-3">
							<p class="text-xs font-medium text-text-muted mb-1">Stack Trace</p>
							<div class="p-3 rounded-lg bg-bg-tertiary max-h-48 overflow-y-auto">
								<pre class="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono">{currentError.stack}</pre>
							</div>
						</div>
					{/if}
				</div>

				<div class="flex gap-3 mt-6 shrink-0">
					{#if remainingCount > 1}
						<button
							class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 border rounded-lg cursor-pointer bg-bg-tertiary border-bg-elevated text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
							onclick={handleDismissAll}
						>
							Dismiss All
						</button>
					{/if}
					<button
						class="flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg cursor-pointer bg-error hover:bg-error/80 text-white"
						onclick={handleDismiss}
					>
						{remainingCount > 1 ? 'Next' : 'Dismiss'}
					</button>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
