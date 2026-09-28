import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { cookies } from "next/headers";

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` çağrısı Server Component'tan geliyorsa
            // cookie set edilemez — bu beklenen davranıştır.
            // Proxy (middleware) veya Server Action'dan çağrılıyorsa sorunsuz çalışır.
          }
        },
      },
    }
  );
};
