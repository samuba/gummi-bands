import type { HandleClientError } from '@sveltejs/kit';
import { errorDialog, type ErrorDetails } from '$lib/components/ErrorDialog.svelte';

// Queue for errors that happen before the dialog is ready
const errorQueue: ErrorDetails[] = [];
let dialogReady = false;

function extractErrorInfo(error: unknown): { message: string; stack?: string } {
	if (error instanceof Error) {
		let message = error.message;
		
		// Include cause if present
		if (error.cause) {
			const causeInfo = extractErrorInfo(error.cause);
			message += `\n\nCaused by: ${causeInfo.message}`;
		}

		// Include any additional properties
		const additionalProps = Object.keys(error).filter(
			(key) => !['name', 'message', 'stack', 'cause'].includes(key)
		);
		if (additionalProps.length > 0) {
			message += '\n\nAdditional info:';
			for (const key of additionalProps) {
				try {
					message += `\n${key}: ${JSON.stringify((error as unknown as Record<string, unknown>)[key])}`;
				} catch {
					message += `\n${key}: [Unable to serialize]`;
				}
			}
		}

		return {
			message,
			stack: error.stack
		};
	} else if (typeof error === 'string') {
		return { message: error };
	} else if (error !== null && typeof error === 'object') {
		try {
			return { message: JSON.stringify(error, null, 2) };
		} catch {
			return { message: String(error) };
		}
	} else {
		return { message: String(error) };
	}
}

function showError(details: ErrorDetails) {
	if (dialogReady && errorDialog.show) {
		errorDialog.show(details);
	} else {
		// Queue the error for when the dialog is ready
		errorQueue.push(details);
	}
}

// Called from the layout once ErrorDialog is mounted
export function markDialogReady() {
	dialogReady = true;
	// Show any queued errors
	while (errorQueue.length > 0) {
		const details = errorQueue.shift()!;
		errorDialog.show(details);
	}
}

// Handle uncaught errors
if (typeof window !== 'undefined') {
	window.onerror = (message, source, lineno, colno, error) => {
		const context = [
			`Source: ${source || 'unknown'}`,
			`Line: ${lineno || 'unknown'}, Column: ${colno || 'unknown'}`
		].join('\n');

		const errorInfo = error ? extractErrorInfo(error) : { message: String(message) };

		showError({
			title: 'Uncaught Error',
			message: errorInfo.message,
			stack: errorInfo.stack,
			context
		});

		// Return false to allow the error to propagate to the console as well
		return false;
	};

	window.onunhandledrejection = (event: PromiseRejectionEvent) => {
		const errorInfo = extractErrorInfo(event.reason);

		showError({
			title: 'Unhandled Promise Rejection',
			message: errorInfo.message,
			stack: errorInfo.stack,
			context: 'Promise rejected without catch handler'
		});
	};
}

// SvelteKit's handleError hook for client-side errors
export const handleError: HandleClientError = ({ error, event, status, message }) => {
	console.error('SvelteKit client error:', error);

	const context = [
		`Status: ${status}`,
		`Message: ${message}`,
		`URL: ${event.url.href}`,
		`Route: ${event.route.id || 'unknown'}`
	].join('\n');

	const errorInfo = extractErrorInfo(error);

	showError({
		title: 'Application Error',
		message: errorInfo.message,
		stack: errorInfo.stack,
		context
	});

	return {
		message: error instanceof Error ? error.message : 'An unexpected error occurred'
	};
};
