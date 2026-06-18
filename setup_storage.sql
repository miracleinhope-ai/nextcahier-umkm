-- ============================================================
-- SETUP: Supabase Storage Bucket "menu-images"
-- Jalankan file ini di Supabase → SQL Editor → Run
-- ============================================================

-- 1. Buat bucket "menu-images" (public = bisa diakses tanpa login)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  2097152,                                           -- maks 2 MB per file
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit   = 2097152,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- 2. Izinkan siapa saja (anon) membaca gambar (GET)
DROP POLICY IF EXISTS "menu-images public read"   ON storage.objects;
CREATE POLICY "menu-images public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'menu-images');

-- 3. Izinkan anon mengupload gambar (INSERT)
DROP POLICY IF EXISTS "menu-images public insert" ON storage.objects;
CREATE POLICY "menu-images public insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'menu-images');

-- 4. Izinkan anon menimpa/update gambar (UPDATE) — untuk fitur ganti foto
DROP POLICY IF EXISTS "menu-images public update" ON storage.objects;
CREATE POLICY "menu-images public update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'menu-images');

-- 5. Izinkan anon menghapus gambar (DELETE) — opsional
DROP POLICY IF EXISTS "menu-images public delete" ON storage.objects;
CREATE POLICY "menu-images public delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'menu-images');

-- ============================================================
-- Tambah kolom image_url ke tabel menus (jika belum ada)
-- ============================================================
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS image_url text;

-- Verifikasi hasil
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'menu-images';
