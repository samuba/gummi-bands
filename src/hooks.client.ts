import type { HandleClientError } from '@sveltejs/kit';

function formatErrorDetails(error: unknown): string {
	const parts: string[] = [];

	if (error instanceof Error) {
		parts.push(`Name: ${error.name}`);
		parts.push(`Message: ${error.message}`);

		if (error.stack) {
			parts.push(`\nStack trace:\n${error.stack}`);
		}

		if (error.cause) {
			parts.push(`\nCause: ${formatErrorDetails(error.cause)}`);
		}

		// Include any additional properties
		const additionalProps = Object.keys(error).filter(
			(key) => !['name', 'message', 'stack', 'cause'].includes(key)
		);
		if (additionalProps.length > 0) {
			parts.push('\nAdditional properties:');
			for (const key of additionalProps) {
				try {
					parts.push(`  ${key}: ${JSON.stringify((error as Record<string, unknown>)[key], null, 2)}`);
				} catch {
					parts.push(`  ${key}: [Unable to serialize]`);
				}
			}
		}
	} else if (typeof error === 'string') {
		parts.push(`Error: ${error}`);
	} else if (error !== null && typeof error === 'object') {
		try {
			parts.push(`Error object: ${JSON.stringify(error, null, 2)}`);
		} catch {
			parts.push(`Error object: ${String(error)}`);
		}
	} else {
		parts.push(`Unknown error: ${String(error)}`);
	}

	return parts.join('\n');
}

function showErrorAlert(title: string, error: unknown, event?: Event | string) {
	const details = formatErrorDetails(error);

	let message = `🚨 ${title}\n\n${details}`;

	if (event && typeof event === 'string') {
		message += `\n\nContext: ${event}`;
	}

	// Use setTimeout to ensure the alert doesn't block synchronous error handling
	setTimeout(() => {
		alert(message);
	}, 0);
}

// Handle uncaught errors
if (typeof window !== 'undefined') {
	window.onerror = (message, source, lineno, colno, error) => {
		const context = `Source: ${source || 'unknown'}\nLine: ${lineno || 'unknown'}, Column: ${colno || 'unknown'}`;

		showErrorAlert(
			'Uncaught Error',
			error || message,
			context
		);

		// Return false to allow the error to propagate to the console as well
		return false;
	};

	window.onunhandledrejection = (event: PromiseRejectionEvent) => {
		showErrorAlert(
			'Unhandled Promise Rejection',
			event.reason,
			'Promise rejected without catch handler'
		);
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

	showErrorAlert('Application Error', error, context);

	return {
		message: error instanceof Error ? error.message : 'An unexpected error occurred'
	};
};
