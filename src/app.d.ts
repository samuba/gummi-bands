// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			logExerciseId?: string;
			addExerciseOpen?: boolean;
			confirmOpen?: boolean;
			editBandOpen?: boolean;
			editTemplateOpen?: boolean;
			startWorkoutOpen?: boolean;
		}
		// interface Platform {}
	}
}

export {};
