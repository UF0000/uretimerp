import { redirect } from "next/navigation";

// Üretim modülünün giriş noktası üretim analizi panosudur.
export default function ProductionRedirectPage() {
  redirect("/uretim/analiz");
}
