import { redirect } from "next/navigation";

export default function RootPage() {
  // Kök dizin: sekmeli çalışma alanı
  redirect("/calisma");
}
