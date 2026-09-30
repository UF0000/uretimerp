import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Uygulama yazı tipi: değiştirmek için yalnızca burası (latin-ext = ğ, ş, İ)
const appSans = Roboto({
  variable: "--font-app-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});


export const metadata: Metadata = {
  title: {
    default: "Üretim ERP",
    template: "%s | Üretim ERP",
  },
  description:
    "Plastik imalat fabrikası için üretim takibi, depo/stok, maliyet, reçete (BOM), sipariş ve kalite yönetimi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${appSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider delay={300}>
          {children}
        </TooltipProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
          }}
        />
      </body>
    </html>
  );
}
