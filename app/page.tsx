import { redirect } from "next/navigation";

export default function RootPage() {
  // Kök dizine gelen istekleri doğrudan dashboard'a yönlendir
  redirect("/dashboard");
}
