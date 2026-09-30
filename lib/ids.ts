/** Kayıt kimliği (UUID) biçim kontrolü: biçimsiz adres veritabanına gitmeden "bulunamadı" sayılır */
export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** PostgREST .single(): kayıt yok (PGRST116) */
export const isNotFound = (error: { code?: string } | null | undefined) => error?.code === "PGRST116";
