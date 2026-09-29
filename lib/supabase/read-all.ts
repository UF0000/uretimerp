type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** PostgREST 1.000 satır sınırına takılmadan tüm sayfaları okur. */
export async function readAll<T>(page: (from: number, to: number) => Page<T>, errorPrefix: string) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(`${errorPrefix}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

/** Büyük id listelerini URL sınırına takılmadan parça parça sorgular. */
export async function inChunks<T>(ids: string[], size: number, run: (chunk: string[]) => Page<T>) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await run(ids.slice(i, i + size));
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}
