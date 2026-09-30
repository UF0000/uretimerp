"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TABS_STORAGE_KEY } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "@/lib/zod";
import { Factory, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

// ─── Form şeması ───────────────────────────────────

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "E-posta adresi gerekli")
    .email("Geçerli bir e-posta adresi girin"),
  password: z
    .string()
    .min(1, "Şifre gerekli")
    .min(6, "Şifre en az 6 karakter olmalı"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ─── Sayfa ─────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error("Giriş başarısız", {
        description:
          error.message === "Invalid login credentials"
            ? "E-posta veya şifre hatalı."
            : error.message,
      });
      return;
    }

    toast.success("Giriş başarılı", {
      description: "Panel'e yönlendiriliyorsunuz...",
    });

    // Sekme içinde (oturum süresi dolmuşsa) sayfaya dön; değilse ana sayfa ekranıyla başla
    if (window.parent !== window) {
      router.push("/dashboard");
    } else {
      try {
        window.sessionStorage.removeItem(TABS_STORAGE_KEY);
      } catch {
        // saklama kapalı: zaten boş başlar
      }
      router.push("/calisma");
    }
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Arka plan dekorasyon */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <Card className="w-full max-w-[420px] relative shadow-lg border-border/50">
        <CardHeader className="text-center pb-2 pt-8">
          {/* Logo */}
          <div className="flex items-center justify-center mx-auto mb-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Factory className="w-7 h-7" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground">Üretim ERP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sisteme giriş yapın
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* E-posta */}
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@fabrika.com"
                autoComplete="email"
                autoFocus
                {...register("email")}
                className={errors.email ? "border-danger" : ""}
              />
              {errors.email && (
                <p className="text-xs text-danger">{errors.email.message}</p>
              )}
            </div>

            {/* Şifre */}
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register("password")}
                  className={errors.password ? "border-danger pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Giriş butonu */}
            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isSubmitting}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Giriş yapılıyor...
                </>
              ) : (
                "Giriş Yap"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
