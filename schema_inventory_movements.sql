-- ============================================================
-- TAMBAHAN: Tabel Arus Inventory (Barang Masuk & Keluar)
-- Jalankan di Supabase SQL Editor SETELAH schema.sql utama
-- ============================================================

-- Tabel log setiap pergerakan stok
CREATE TABLE IF NOT EXISTS inventory_movements (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id      uuid        NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  type         text        NOT NULL CHECK (type IN ('in','out')),
  -- 'in'  = pembelian / stok masuk
  -- 'out' = penjualan (dari kasir) / penyesuaian keluar
  qty          int         NOT NULL CHECK (qty > 0),
  ref_type     text        DEFAULT 'manual',
  -- 'purchase' = pembelian supplier
  -- 'sale'     = penjualan kasir (order_id terisi)
  -- 'adjustment' = koreksi manual
  ref_id       uuid,       -- order_id jika berasal dari penjualan
  supplier     text,       -- nama supplier (untuk pembelian)
  unit_cost    numeric(12,2),  -- harga beli per unit
  notes        text,
  movement_date date       DEFAULT CURRENT_DATE,
  created_at   timestamptz DEFAULT now(),
  created_by   uuid        REFERENCES users(id)
);

-- Nonaktifkan RLS
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_inv_mov_menu   ON inventory_movements(menu_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type   ON inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_date   ON inventory_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_ref    ON inventory_movements(ref_id);
