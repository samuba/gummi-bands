import { describe, expect, it } from 'vitest';
import { getCatalogNameKey } from './catalog';

describe('getCatalogNameKey', () => {
	it('normalizes names for duplicate catalog matching', () => {
		expect.assertions(3);

		expect(getCatalogNameKey(' Push Day ')).toBe('push day');
		expect(getCatalogNameKey('Push   Day')).toBe('push day');
		expect(getCatalogNameKey('\tPUSH\nDAY')).toBe('push day');
	});
});
