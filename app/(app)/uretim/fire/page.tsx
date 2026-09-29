import { redirect } from "next/navigation";

// Fire ve OEE raporları Üretim Analizi panosunda (Boru / Fitting) birleşti.
export default function MergedReportRedirect() {
  redirect("/uretim/analiz");
}
