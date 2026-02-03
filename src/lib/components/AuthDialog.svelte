<script lang="ts" module>
	export type AuthMode = 'signIn' | 'signUp';

	export const authDialog: {
		open: (mode?: AuthMode) => void;
	} = {
		open: null!,
	};
</script>

<script lang="ts">
	import { Dialog } from './dialog';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient, sessionStore } from '$lib/auth-client';

	const open = $derived(page.state.authOpen === true);
	let mode = $state<AuthMode>('signIn');
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Form fields
	let email = $state('');
	let password = $state('');
	let name = $state('');

	function openAuthDialog(initialMode: AuthMode = 'signIn') {
		mode = initialMode;
		error = null;
		email = '';
		password = '';
		name = '';
		pushState('', { ...page.state, authOpen: true });
	}

	function handleOpenChange(isOpen: boolean) {
		if (isOpen) {
			pushState('', { ...page.state, authOpen: true });
		} else {
			if (page.state.authOpen) {
				history.back();
			}
		}
	}

	function handleClose() {
		handleOpenChange(false);
	}

	function switchMode() {
		mode = mode === 'signIn' ? 'signUp' : 'signIn';
		error = null;
	}

	async function handleEmailSubmit(e: Event) {
		e.preventDefault();
		error = null;
		isLoading = true;

		try {
			if (mode === 'signUp') {
				const result = await authClient.signUp.email(
					{
						email,
						password,
						name,
					},
					{
						onSuccess: async () => {
							// Refetch session to update the store
							await sessionStore.get().refetch();
							handleClose();
						},
						onError: (ctx) => {
							error = ctx.error.message ?? 'Sign up failed';
						},
					}
				);
				if (result.error) {
					error = result.error.message ?? 'Sign up failed';
				}
			} else {
				const result = await authClient.signIn.email(
					{
						email,
						password,
					},
					{
						onSuccess: async () => {
							// Refetch session to update the store
							await sessionStore.get().refetch();
							handleClose();
						},
						onError: (ctx) => {
							error = ctx.error.message ?? 'Sign in failed';
						},
					}
				);
				if (result.error) {
					error = result.error.message ?? 'Sign in failed';
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}

	async function handleGoogleSignIn() {
		error = null;
		isLoading = true;

		try {
			await authClient.signIn.social({
				provider: 'google',
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Google sign in failed';
			isLoading = false;
		}
	}

	authDialog.open = openAuthDialog;
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="z-60" />
		<Dialog.Content class="z-60 max-w-sm flex flex-col">
			<!-- Logo/Title -->
			<div class="flex flex-col items-center mb-6 shrink-0">
				<h1
					class="text-3xl font-display tracking-wider uppercase bg-clip-text text-transparent"
					style="background-image: var(--gradient-fire)"
				>
					Gummi Bands
				</h1>
				<p class="mt-1 text-sm text-text-muted">
					{mode === 'signIn' ? 'Welcome back!' : 'Create your account'}
				</p>
			</div>

			<!-- Error message -->
			{#if error}
				<div
					class="flex items-center gap-2 p-3 mb-4 text-sm rounded-lg bg-error/20 text-error shrink-0"
				>
					<i class="icon-[ph--warning-circle] size-5"></i>
					{error}
				</div>
			{/if}

			<!-- Google Sign In -->
			<button
				type="button"
				onclick={handleGoogleSignIn}
				disabled={isLoading}
				class="flex items-center justify-center gap-3 w-full px-4 py-3 text-sm font-medium transition-all duration-200 border rounded-lg cursor-pointer bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<svg class="size-5" viewBox="0 0 24 24">
					<path
						fill="#4285F4"
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
					/>
					<path
						fill="#34A853"
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
					/>
					<path
						fill="#FBBC05"
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
					/>
					<path
						fill="#EA4335"
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
					/>
				</svg>
				Continue with Google
			</button>

			<!-- Divider -->
			<div class="flex items-center gap-4 my-5 shrink-0">
				<div class="flex-1 h-px bg-bg-elevated"></div>
				<span class="text-xs text-text-muted uppercase tracking-wider">or</span>
				<div class="flex-1 h-px bg-bg-elevated"></div>
			</div>

			<!-- Email/Password Form -->
			<form onsubmit={handleEmailSubmit} class="flex flex-col gap-4">
				{#if mode === 'signUp'}
					<div>
						<label for="auth-name" class="block mb-2 text-sm font-medium text-text-secondary">
							Name
						</label>
					<input
						id="auth-name"
						type="text"
						bind:value={name}
						placeholder="Your name"
						required
						class="w-full px-4 py-3 text-sm transition-colors duration-200 border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
					/>
					</div>
				{/if}

				<div>
					<label for="auth-email" class="block mb-2 text-sm font-medium text-text-secondary">
						Email
					</label>
				<input
					id="auth-email"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					required
					class="w-full px-4 py-3 text-sm transition-colors duration-200 border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
				/>
				</div>

				<div>
					<label for="auth-password" class="block mb-2 text-sm font-medium text-text-secondary">
						Password
					</label>
				<input
					id="auth-password"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					required
					minlength="8"
					class="w-full px-4 py-3 text-sm transition-colors duration-200 border-2 rounded-lg bg-bg-tertiary border-bg-elevated text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
				/>
				</div>

				<button type="submit" disabled={isLoading} class="btn-primary mt-2 disabled:opacity-50">
					{#if isLoading}
						<i class="icon-[ph--spinner] size-5 animate-spin"></i>
					{:else}
						{mode === 'signIn' ? 'Sign In' : 'Create Account'}
					{/if}
				</button>
			</form>

			<!-- Switch mode -->
			<p class="mt-6 text-sm text-center text-text-muted shrink-0">
				{mode === 'signIn' ? "Don't have an account?" : 'Already have an account?'}
				<button
					type="button"
					onclick={switchMode}
					class="ml-1 font-medium text-primary hover:underline cursor-pointer bg-transparent border-none"
				>
					{mode === 'signIn' ? 'Sign up' : 'Sign in'}
				</button>
			</p>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
