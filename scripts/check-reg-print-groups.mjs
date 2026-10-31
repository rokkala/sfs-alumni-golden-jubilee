/** Smoke: registrations print groups by batch, names A→Z. */
import { groupByBatchSorted } from '../lib/admin/reg-print-groups.ts';

const rows = [
  { full_name: 'Zed', batch: 1990 },
  { full_name: 'Amy', batch: 1990 },
  { full_name: 'Bob', batch: 1985 },
  { full_name: 'No Batch', batch: null },
];

const groups = groupByBatchSorted(rows);
if (groups.length !== 3) throw new Error(`expected 3 groups, got ${groups.length}`);
if (groups[0].batchLabel !== 'Batch 1985') throw new Error(groups[0].batchLabel);
if (groups[1].rows.map((r) => r.full_name).join(',') !== 'Amy,Zed') {
  throw new Error(`name order: ${groups[1].rows.map((r) => r.full_name)}`);
}
if (groups[2].batchLabel !== 'Batch unknown') throw new Error(groups[2].batchLabel);
console.log('ok: reg print groups');
