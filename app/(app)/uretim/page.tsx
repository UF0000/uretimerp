import { redirect } from "next/navigation";

// Üretim modülünün giriş noktası iş emirleri listesidir.
export default function ProductionRedirectPage() {
  redirect("/uretim/is-emirleri");
}
