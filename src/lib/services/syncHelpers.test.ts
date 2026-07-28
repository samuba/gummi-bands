import { describe, expect, it } from 'vitest';
import {
	getOrphanSyncedJunctionIds,
	getSafeReplacementTemplateIds,
	resolveExercisesByPlannedIds
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
