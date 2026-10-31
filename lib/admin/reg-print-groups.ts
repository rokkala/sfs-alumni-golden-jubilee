export type RegPrintRow = {
  full_name: string;
  batch: number | null;
};

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

/** Group by batch (unknown last), sort names within each batch. */
export function groupByBatchSorted<T extends RegPrintRow>(
  rows: T[]
): { batchLabel: string; batchSort: number; rows: T[] }[] {
  const map = new Map<number | 'unknown', T[]>();
  for (const r of rows) {
    const key = r.batch != null && Number.isFinite(r.batch) ? r.batch : 'unknown';
    const list = map.get(key) || [];
    list.push(r);
    map.set(key, list);
  }
  const groups = [...map.entries()].map(([key, list]) => ({
    batchLabel: key === 'unknown' ? 'Batch unknown' : `Batch ${key}`,
    batchSort: key === 'unknown' ? Number.POSITIVE_INFINITY : key,
    rows: [...list].sort((a, b) => nameKey(a.full_name).localeCompare(nameKey(b.full_name))),
  }));
  groups.sort((a, b) => a.batchSort - b.batchSort);
  return groups;
}
