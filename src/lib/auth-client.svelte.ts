import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient();

// Shared session store for use across components (use with $ prefix: $sessionStore)
export const sessionStore = authClient.useSession();

