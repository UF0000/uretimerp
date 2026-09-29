-- Test borularının hedef hızı: 18 m/dk (= 1080 m/saat; saklama birimi m/saat, ekranda m/dk)
UPDATE bom_extrusion be
   SET target_m_per_hour = 1080
  FROM boms b
 WHERE b.id = be.bom_id
   AND b.code IN ('TEST-RCT-BORU', 'TEST-RCT-BORU2');
