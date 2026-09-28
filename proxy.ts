import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aşağıdaki yollar HARİÇ tüm isteklerde çalışır:
     * - _next/static (statik dosyalar)
     * - _next/image (resim optimizasyonu)
     * - favicon.ico (favicon)
     * - Resim dosyaları (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
