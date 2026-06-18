-- ============================================
-- KASIR POS - SUPABASE POSTGRESQL DDL v2
-- Jalankan di Supabase SQL Editor
-- ============================================

create extension if not exists "uuid-ossp";

-- Users (custom auth, no Supabase Auth email)
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  name text not null,
  role text not null check (role in ('superadmin','admin','kasir')),
  password text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);

-- Tables Layout
create table if not exists tables_layout (
  id uuid primary key default uuid_generate_v4(),
  table_number int not null unique,
  row_position int not null default 0,
  col_position int not null default 0,
  status text not null default 'available' check (status in ('available','occupied','reserved')),
  created_at timestamptz default now(),
  created_by uuid references users(id)
);

-- Menus
create table if not exists menus (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  price numeric(12,2) not null default 0,
  type text not null default 'non-inventory' check (type in ('inventory','non-inventory')),
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);

-- Inventory
create table if not exists inventory (
  id uuid primary key default uuid_generate_v4(),
  menu_id uuid not null references menus(id) on delete cascade,
  stock_initial int not null default 0,
  stock_in int not null default 0,
  stock_out int not null default 0,
  current_stock int generated always as (stock_initial + stock_in - stock_out) stored,
  updated_at timestamptz default now(),
  updated_by uuid references users(id)
);

-- Orders
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  table_number int not null,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_amount numeric(12,2),
  change_amount numeric(12,2),
  notes text,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);

-- Order Items
create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_id uuid not null references menus(id),
  menu_name text not null,
  qty int not null default 1,
  price numeric(12,2) not null default 0,
  subtotal numeric(12,2) generated always as (qty * price) stored,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);

-- ── Seed superadmin (password plain-text, ganti dengan hash di produksi) ──
insert into users (username, name, role, password)
values ('superadmin', 'Super Admin', 'superadmin', '27112014@1')
on conflict (username) do nothing;

-- Seed sample menus
insert into menus (name, price, type) values
  ('Nasi Goreng',  25000, 'inventory'),
  ('Mie Goreng',   22000, 'inventory'),
  ('Ayam Bakar',   35000, 'inventory'),
  ('Soto Ayam',    20000, 'inventory'),
  ('Gado-Gado',    18000, 'inventory'),
  ('Es Teh Manis',  5000, 'non-inventory'),
  ('Kopi Hitam',    8000, 'non-inventory'),
  ('Jus Jeruk',    12000, 'non-inventory')
on conflict do nothing;

-- Seed inventory
insert into inventory (menu_id, stock_initial, stock_in, stock_out)
select id, 50, 0, 0 from menus where type = 'inventory'
on conflict do nothing;

-- Seed 8 meja
insert into tables_layout (table_number, row_position, col_position)
select n, (n-1)/4, (n-1)%4 from generate_series(1,8) as n
on conflict do nothing;

-- ── RLS: nonaktifkan untuk dev, aktifkan + tambah policy di produksi ──
alter table users         disable row level security;
alter table tables_layout disable row level security;
alter table menus         disable row level security;
alter table inventory     disable row level security;
alter table orders        disable row level security;
alter table order_items   disable row level security;
