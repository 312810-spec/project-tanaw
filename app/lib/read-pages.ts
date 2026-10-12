type Page<T> = { data: T[] | null; error: unknown; count?: number | null };

/** Read a stable, ordered query completely; fail rather than accepting truncation. */
export async function readPages<T>(read: (from: number, to: number) => PromiseLike<Page<T>>, pageSize = 200): Promise<T[]> {
  const rows: T[] = [];
  let expected: number | null = null;
  for (let page = 0; page < 250; page++) {
    const result = await read(rows.length, rows.length + pageSize - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Page unavailable");
    if (result.count != null) {
      if (expected !== null && expected !== result.count) throw new Error("Records changed while paging; refresh");
      expected = result.count;
    }
    rows.push(...result.data);
    if (result.data.length < pageSize) {
      if (expected !== null && rows.length !== expected) throw new Error("Incomplete page; refresh");
      return rows;
    }
  }
  throw new Error("Read limit reached; narrow the reporting scope");
}
