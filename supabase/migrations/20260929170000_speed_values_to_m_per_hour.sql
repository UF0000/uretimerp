-- Reçetelerdeki hedef hızlar m/dk olarak girilmişti ama alan m/saat (OEE ideal süresi saat bazlı).
-- Değerler 60 ile çarpılarak m/saat'e çevrilir; ekran bundan sonra m/dk gösterir ve girer.
-- Koruma: 150'nin altındaki değerler m/dk kabul edilir (gerçek m/saat değerleri çok daha büyüktür);
-- yeni ekrandan girilmiş (zaten ×60) ve test reçetesi değerlerine dokunulmaz.
UPDATE bom_extrusion be
   SET target_m_per_hour = be.target_m_per_hour * 60
  FROM boms b
 WHERE b.id = be.bom_id
   AND be.target_m_per_hour IS NOT NULL
   AND be.target_m_per_hour < 150
   AND b.code NOT IN ('TEST-RCT-BORU', 'TEST-RCT-BORU2');
