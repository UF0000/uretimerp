import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Alt sayfalardan bir üst sayfaya dönüş (sekme içinde aynı bölümde kalır) */
export const BackLink = ({ href, label }: { href: string; label: string }) => (
  <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground print:hidden">
    <ArrowLeft className="h-4 w-4" aria-hidden />
    {label}
  </Link>
);
