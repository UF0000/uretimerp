/**
 * Türkçe hata mesajlarıyla yapılandırılmış Zod. Doğrulama şemaları "zod" yerine
 * buradan içe aktarır; böylece özel mesaj yazılmayan alanlarda da kullanıcı
 * İngilizce/teknik hata görmez.
 */
import { z } from "zod";

z.config(z.locales.tr());
z.config({
  customError: (issue) => {
    if (issue.code === "invalid_type") {
      const input = issue.input;
      if (input === undefined || input === null || input === "") return "Bu alan zorunludur";
      if (issue.expected === "number") return "Geçerli bir sayı girin";
    }
    return undefined; // diğerleri: Türkçe dil paketi
  },
});

export { z };
