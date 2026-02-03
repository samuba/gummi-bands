import { browser } from '$app/environment';
import { db } from '$lib/db/app/client';
import * as s from '$lib/db/app/schema';
import { eq } from 'drizzle-orm';
import { wakeLock } from './wakeLock.svelte';

class SettingsStore {
	#weightUnit = $state<'lbs' | 'kg'>('lbs');
	#keepScreenAwake = $state(true);
	#initialized = $state(false);

	get weightUnit() {
		return this.#weightUnit;
	}

	get keepScreenAwake() {
		return this.#keepScreenAwake;
	}

	get initialized() {
		return this.#initialized;
	}

	async initialize() {
		if (!browser || this.#initialized) return;

		const existingSettings = await db.query.settings.findFirst({
			where: eq(s.settings.id, 'global')
		});

		if (!existingSettings) {
			await db.insert(s.settings).values({ id: 'global', weightUnit: 'lbs', keepScreenAwake: true });
			this.#weightUnit = 'lbs';
			this.#keepScreenAwake = true;
		} else {
			this.#weightUnit = existingSettings.weightUnit;
			this.#keepScreenAwake = existingSettings.keepScreenAwake;
		}

		// Initialize wake lock with the saved setting
		wakeLock.initialize(this.#keepScreenAwake);

		this.#initialized = true;
	}

	async updateWeightUnit(unit: 'lbs' | 'kg') {
		await db.update(s.settings).set({ weightUnit: unit }).where(eq(s.settings.id, 'global'));
		this.#weightUnit = unit;
	}

	async updateKeepScreenAwake(enabled: boolean) {
		await db.update(s.settings).set({ keepScreenAwake: enabled }).where(eq(s.settings.id, 'global'));
		this.#keepScreenAwake = enabled;
		wakeLock.enabled = enabled;
	}

	formatWeight(lbs: number): string {
		const val = this.#weightUnit === 'lbs' ? lbs : lbs * 0.45359237;
		const unit = this.#weightUnit === 'lbs' ? 'pound' : 'kilogram';
		return new Intl.NumberFormat(navigator.language, {
			maximumFractionDigits: 1,
			style: 'unit',
			unit,
			unitDisplay: 'short'
		}).format(val);
	}

	formatNumber(num: number, maximumFractionDigits = 1): string {
		return new Intl.NumberFormat(navigator.language, {
			maximumFractionDigits
		}).format(num);
	}

	toUserWeight(lbs: number): number {
		if (this.#weightUnit === 'lbs') return lbs;
		return Math.round((lbs * 0.45359237) * 10) / 10;
	}

	fromUserWeight(weight: number): number {
		if (this.#weightUnit === 'lbs') return weight;
		return weight / 0.45359237;
	}
}

export const settings = new SettingsStore();
