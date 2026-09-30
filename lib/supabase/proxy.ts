import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { NextResponse, type NextRequest } from "next/server";

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() çağrısı auth token'ı yenilemek için gerekli.
  // getSession() yerine getUser() kullanılmalı — sunucu tarafında güvenli doğrulama.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Oturumsuz kullanıcıları login'e yönlendir
  // (login ve auth callback sayfaları hariç)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Uygulama sayfası tarayıcıda doğrudan açıldıysa (sekme/iframe değil) sekmeli çalışma alanında aç
  const path = request.nextUrl.pathname;
  if (
    user &&
    request.method === "GET" &&
    request.headers.get("sec-fetch-dest") === "document" &&
    path !== "/" &&
    !/^\/(calisma|login|auth|api)(\/|$)/.test(path)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/calisma";
    url.search = `?ac=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return supabaseResponse;
};
