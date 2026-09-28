// Canlı Supabase şemasından lib/supabase/database.types.ts üretir.
// `supabase gen types` ile aynı biçim; Docker gerektirmez. Sadece okuma yapar.
// Kullanım: npm run db:types   (.env.local içinde SUPABASE_DB_URL gerekir)

import fs from "node:fs";
import pg from "pg";

const OUT = "lib/supabase/database.types.ts";
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  process.stderr.write(".env.local içinde SUPABASE_DB_URL bulunamadı.\n");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const q = async (sql) => (await client.query(sql)).rows;

const enums = await q(`
  SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY t.typname`);

const columns = await q(`
  SELECT c.relname AS tbl, c.relkind AS kind, a.attname AS col, a.attnum AS pos,
         NOT a.attnotnull AS nullable,
         (a.atthasdef OR a.attidentity <> '' OR a.attgenerated <> '') AS has_default,
         ty.typname AS type, ty.typtype AS typtype, ety.typname AS elem_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type ty ON ty.oid = a.atttypid
  LEFT JOIN pg_type ety ON ety.oid = ty.typelem AND ty.typcategory = 'A'
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
    AND a.attnum > 0 AND NOT a.attisdropped
  ORDER BY c.relname, a.attnum`);

const fks = await q(`
  SELECT con.conname AS name, src.relname AS tbl, dst.relname AS ref,
         (SELECT array_agg(attname::text ORDER BY k.ord) FROM unnest(con.conkey) WITH ORDINALITY k(num, ord)
            JOIN pg_attribute ON attrelid = con.conrelid AND attnum = k.num) AS cols,
         (SELECT array_agg(attname::text ORDER BY k.ord) FROM unnest(con.confkey) WITH ORDINALITY k(num, ord)
            JOIN pg_attribute ON attrelid = con.confrelid AND attnum = k.num) AS ref_cols,
         EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = con.conrelid AND i.indisunique
                   AND i.indpred IS NULL AND (i.indkey::int2[])::int2[] @> con.conkey
                   AND array_length(i.indkey::int2[], 1) = array_length(con.conkey, 1)) AS one_to_one
  FROM pg_constraint con
  JOIN pg_class src ON src.oid = con.conrelid
  JOIN pg_class dst ON dst.oid = con.confrelid
  JOIN pg_namespace n ON n.oid = src.relnamespace
  WHERE con.contype = 'f' AND n.nspname = 'public'
  ORDER BY src.relname, con.conname`);

const functions = await q(`
  SELECT p.proname AS name, p.pronargs AS nargs, p.pronargdefaults AS ndefaults,
         p.proargnames AS arg_names,
         (SELECT array_agg(t.typname::text ORDER BY o.ord) FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY o(oid, ord)
            JOIN pg_type t ON t.oid = o.oid) AS arg_types,
         (SELECT array_agg(et.typname::text ORDER BY o.ord) FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY o(oid, ord)
            JOIN pg_type t ON t.oid = o.oid LEFT JOIN pg_type et ON et.oid = t.typelem AND t.typcategory = 'A') AS arg_elem_types,
         rt.typname AS ret_type, p.proretset AS returns_set
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_type rt ON rt.oid = p.prorettype
  WHERE n.nspname = 'public' AND rt.typname <> 'trigger'
  ORDER BY p.proname`);

await client.end();

const enumNames = new Set(enums.map((e) => e.name));
const scalar = (t) => {
  if (enumNames.has(t)) return `Database["public"]["Enums"]["${t}"]`;
  if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(t)) return "number";
  if (t === "bool") return "boolean";
  if (["json", "jsonb"].includes(t)) return "Json";
  if (t === "void") return "undefined";
  return "string"; // uuid, text, date, timestamptz, ...
};
const tsType = (type, elem) => (elem ? `${scalar(elem)}[]` : scalar(type));
const key = (k) => (/^[a-z_][a-z0-9_]*$/i.test(k) ? k : JSON.stringify(k));

const byRel = new Map();
for (const c of columns) {
  if (!byRel.has(c.tbl)) byRel.set(c.tbl, { kind: c.kind, cols: [] });
  byRel.get(c.tbl).cols.push(c);
}

const I = (n) => "  ".repeat(n);
const relationships = (tbl, depth) => {
  const list = fks.filter((f) => f.tbl === tbl);
  if (!list.length) return "[]";
  return "[\n" + list.map((f) =>
    `${I(depth + 1)}{\n` +
    `${I(depth + 2)}foreignKeyName: "${f.name}"\n` +
    `${I(depth + 2)}columns: [${f.cols.map((c) => `"${c}"`).join(", ")}]\n` +
    `${I(depth + 2)}isOneToOne: ${f.one_to_one}\n` +
    `${I(depth + 2)}referencedRelation: "${f.ref}"\n` +
    `${I(depth + 2)}referencedColumns: [${f.ref_cols.map((c) => `"${c}"`).join(", ")}]\n` +
    `${I(depth + 1)}},`
  ).join("\n") + `\n${I(depth)}]`;
};

const rowBlock = (cols, mode, depth) =>
  "{\n" + cols.map((c) => {
    const t = tsType(c.type, c.elem_type) + (c.nullable ? " | null" : "");
    const optional = mode === "Update" || (mode === "Insert" && (c.nullable || c.has_default));
    return `${I(depth + 1)}${key(c.col)}${optional ? "?" : ""}: ${t}`;
  }).join("\n") + `\n${I(depth)}}`;

const tables = [...byRel].filter(([, r]) => r.kind === "r");
const views = [...byRel].filter(([, r]) => r.kind !== "r");

let out = `// Bu dosya scripts/gen-db-types.mjs tarafından üretilir — elle düzenlemeyin.
// Yenilemek için: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
`;
for (const [name, r] of tables) {
  out += `${I(3)}${name}: {\n`;
  for (const mode of ["Row", "Insert", "Update"]) out += `${I(4)}${mode}: ${rowBlock(r.cols, mode, 4)}\n`;
  out += `${I(4)}Relationships: ${relationships(name, 4)}\n${I(3)}}\n`;
}
out += `${I(2)}}\n${I(2)}Views: {\n`;
for (const [name, r] of views) {
  // Görünüm sütunları her zaman nullable raporlanır
  const cols = r.cols.map((c) => ({ ...c, nullable: true }));
  out += `${I(3)}${name}: {\n${I(4)}Row: ${rowBlock(cols, "Row", 4)}\n${I(4)}Relationships: []\n${I(3)}}\n`;
}
out += `${I(2)}}\n${I(2)}Functions: {\n`;
for (const f of functions) {
  const names = f.arg_names ?? [];
  const types = f.arg_types ?? [];
  const elems = f.arg_elem_types ?? [];
  const firstDefault = f.nargs - f.ndefaults;
  const args = types.map((t, i) =>
    `${I(5)}${key(names[i] ?? `arg${i}`)}${i >= firstDefault ? "?" : ""}: ${tsType(t, elems[i])}`);
  const ret = scalar(f.ret_type) + (f.returns_set ? "[]" : "");
  out += `${I(3)}${f.name}: {\n${I(4)}Args: ${args.length ? `{\n${args.join("\n")}\n${I(4)}}` : "never"}\n${I(4)}Returns: ${ret}\n${I(3)}}\n`;
}
out += `${I(2)}}\n${I(2)}Enums: {\n`;
for (const e of enums) out += `${I(3)}${e.name}: ${e.labels.map((l) => `"${l}"`).join(" | ")}\n`;
out += `${I(2)}}\n${I(2)}CompositeTypes: {\n${I(3)}[_ in never]: never\n${I(2)}}\n  }\n}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
`;

fs.writeFileSync(OUT, out);
process.stdout.write(`${OUT} yazıldı: ${tables.length} tablo, ${views.length} görünüm, ${functions.length} fonksiyon, ${enums.length} enum\n`);
