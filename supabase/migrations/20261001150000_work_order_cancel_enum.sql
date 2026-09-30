-- İş emri iptali için yeni durum (kullanımı ayrı migration'da: yeni enum değeri aynı işlemde kullanılamaz)
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'cancelled';
