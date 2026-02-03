import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient();

// Shared session store for use across components
export const sessionStore = authClient.useSession();
