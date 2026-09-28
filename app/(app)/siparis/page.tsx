import { redirect } from "next/navigation";

// Eski adres; siparişler /siparisler altında.
export default function OrderRedirectPage() {
  redirect("/siparisler");
}
