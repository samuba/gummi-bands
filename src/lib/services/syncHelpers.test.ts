import { describe, expect, it } from 'vitest';
import {
	chunkArray,
	getOrphanSyncedJunctionIds,
	getSafeReplacementTemplateIds,
	hasPushWork,
	idsOf,
	resolveExercisesByPlannedIds,
	resolveRemappedIds,
	resolveSyncedMarkTargets,
	rowsNeedingWrite,
	shouldPullAllLoggedExerciseBands,
	shouldRepairCatalogOnPull,
	syncRetryDelayMs
} from './syncHelpers';

describe('getSafeReplacementTemplateIds', () => {
	it('only includes explicitly marked templates', () => {
		expect.assertions(1);

		const result = getSafeReplacementTemplateIds({
			markedTemplateIds: ['t1', 't2'],
			localExerciseCountsByTemplateId: new Map([
				['t1', 3],
				['t2', 1],
				['t3', 5]
			])
		});

		expect(result).toEqual(['t1', 't2']);
	});

	it('skips marked templates with zero local exercises by default', () => {
		expect.assertions(1);

		const result = getSafeReplacementTemplateIds({
			markedTemplateIds: ['t-empty', 't-ok'],
			localExerciseCountsByTemplateId: new Map([
				['t-empty', 0],
				['t-ok', 2]
			])
		});

		expect(result).toEqual(['t-ok']);
	});

	it('allows empty replace when explicitly enabled', () => {
		expect.assertions(1);

		const result = getSafeReplacementTemplateIds({
			markedTemplateIds: ['t-empty'],
			localExerciseCountsByTemplateId: new Map([['t-empty', 0]]),
			allowEmptyReplace: true
		});

		expect(result).toEqual(['t-empty']);
	});
});

describe('getOrphanSyncedJunctionIds', () => {
	it('returns synced local ids absent from the pull', () => {
		expect.assertions(1);

		expect(getOrphanSyncedJunctionIds(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b']);
	});
});

describe('resolveExercisesByPlannedIds', () => {
	it('preserves planned order and skips missing ids', () => {
		expect.assertions(1);

		const exercises = resolveExercisesByPlannedIds(
			['e2', 'missing', 'e1', 'e2'],
			new Map([
				['e1', { id: 'e1', name: 'One' }],
				['e2', { id: 'e2', name: 'Two' }]
			])
		);

		expect(exercises.map((e) => e.id)).toEqual(['e2', 'e1']);
	});
});

describe('idsOf', () => {
	it('collects ids from pushed rows', () => {
		expect.assertions(1);
		expect(idsOf([{ id: 'a' }, { id: 'b' }])).toEqual(['a', 'b']);
	});
});

describe('resolveRemappedIds', () => {
	it('keeps ids unchanged when no remaps', () => {
		expect.assertions(1);
		expect(resolveRemappedIds(['a', 'b'])).toEqual(['a', 'b']);
	});

	it('applies remaps and dedupes canonical ids', () => {
		expect.assertions(1);
		expect(
			resolveRemappedIds(['local-1', 'local-2', 'local-3'], {
				'local-1': 'server-1',
				'local-2': 'server-1'
			})
		).toEqual(['server-1', 'local-3']);
	});
});

describe('resolveSyncedMarkTargets', () => {
	const t1 = new Date('2026-01-01T00:00:00.000Z');
	const t2 = new Date('2026-01-02T00:00:00.000Z');

	it('keeps snapshot updatedAt when not remapped', () => {
		expect.assertions(1);
		expect(
			resolveSyncedMarkTargets([
				{ id: 'a', updatedAt: t1 },
				{ id: 'b', updatedAt: t2 }
			])
		).toEqual([
			{ id: 'a', updatedAt: t1 },
			{ id: 'b', updatedAt: t2 }
		]);
	});

	it('marks remapped ids unconditionally and dedupes', () => {
		expect.assertions(1);
		expect(
			resolveSyncedMarkTargets(
				[
					{ id: 'local-1', updatedAt: t1 },
					{ id: 'local-2', updatedAt: t2 },
					{ id: 'local-3', updatedAt: t1 }
				],
				{
					'local-1': 'server-1',
					'local-2': 'server-1'
				}
			)
		).toEqual([
			{ id: 'server-1', updatedAt: null },
			{ id: 'local-3', updatedAt: t1 }
		]);
	});
});

describe('hasPushWork', () => {
	it('is false when nothing dirty and no replacements', () => {
		expect.assertions(1);
		expect(hasPushWork({ rowCounts: [0, 0, 0], replacementTemplateIds: [] })).toBe(false);
	});

	it('is true when any row count is positive', () => {
		expect.assertions(1);
		expect(hasPushWork({ rowCounts: [0, 2, 0], replacementTemplateIds: [] })).toBe(true);
	});

	it('is true for empty template exercise replacements', () => {
		expect.assertions(1);
		expect(hasPushWork({ rowCounts: [0, 0], replacementTemplateIds: ['t1'] })).toBe(true);
	});
});

describe('shouldRepairCatalogOnPull', () => {
	it('repairs only on first sync', () => {
		expect.assertions(3);
		expect(shouldRepairCatalogOnPull(null)).toBe(true);
		expect(shouldRepairCatalogOnPull(undefined)).toBe(true);
		expect(shouldRepairCatalogOnPull('2026-01-01T00:00:00.000Z')).toBe(false);
	});
});

describe('syncRetryDelayMs', () => {
	it('doubles until the cap', () => {
		expect.assertions(4);
		expect(syncRetryDelayMs(0, 2000, 60_000)).toBe(2000);
		expect(syncRetryDelayMs(1, 2000, 60_000)).toBe(4000);
		expect(syncRetryDelayMs(2, 2000, 60_000)).toBe(8000);
		expect(syncRetryDelayMs(10, 2000, 60_000)).toBe(60_000);
	});
});

describe('chunkArray', () => {
	it('splits into fixed-size chunks', () => {
		expect.assertions(1);
		expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});
});

describe('rowsNeedingWrite', () => {
	it('skips unchanged local rows', () => {
		expect.assertions(1);
		expect(
			rowsNeedingWrite(
				[
					{ id: 'a', value: 1 },
					{ id: 'b', value: 2 },
					{ id: 'c', value: 3 }
				],
				new Map([
					['a', { id: 'a', value: 1 }],
					['b', { id: 'b', value: 9 }]
				]),
				(local, row) => local.value === row.value
			)
		).toEqual([
			{ id: 'b', value: 2 },
			{ id: 'c', value: 3 }
		]);
	});
});

describe('shouldPullAllLoggedExerciseBands', () => {
	it('pulls all on first sync or when bands changed', () => {
		expect.assertions(3);
		expect(shouldPullAllLoggedExerciseBands({ isFirstSync: true, pulledBandCount: 0 })).toBe(true);
		expect(shouldPullAllLoggedExerciseBands({ isFirstSync: false, pulledBandCount: 2 })).toBe(true);
		expect(shouldPullAllLoggedExerciseBands({ isFirstSync: false, pulledBandCount: 0 })).toBe(false);
	});
});
