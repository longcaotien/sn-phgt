-- ============================================================================
--  Solo Leveling Birthday — khung quản trị
--  Chạy file này trong Supabase → SQL Editor (một lần duy nhất).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Hồ sơ người dùng
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  -- Bị chặn thì toàn bộ nội dung web bị khoá với người này.
  blocked     boolean not null default false,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- 2. Cấu hình toàn site (một dòng duy nhất, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.site_config (
  id            int primary key default 1 check (id = 1),
  -- Công tắc tổng: tắt là cả web hiện màn hình bảo trì.
  site_open     boolean not null default true,
  -- Lời nhắn hiện trên màn hình bảo trì / màn hình bị chặn.
  maintenance_message text not null default 'Khu vườn đang được chăm sóc, quay lại sau nhé!',
  -- Bật/tắt việc lưu gemini key phía server.
  gemini_enabled boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

insert into public.site_config (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Gemini API key — LƯU Ở SCHEMA RIÊNG, KHÔNG AI ĐỌC ĐƯỢC TỪ TRÌNH DUYỆT
--    (không có policy select nào => RLS chặn sạch; chỉ edge function
--    dùng service_role mới đọc được)
-- ---------------------------------------------------------------------------
create schema if not exists private;

create table if not exists private.secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tự tạo hồ sơ khi có người đăng nhập Google lần đầu
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. Danh sách email quản trị viên
--    ⚠️ SỬA DÒNG DƯỚI: thay bằng email Google của bạn.
--    Có thể thêm nhiều email, cách nhau bằng dấu phẩy.
-- ---------------------------------------------------------------------------
create or replace function public.admin_emails()
returns text[]
language sql
immutable
as $$
  select string_to_array(lower('thay-email-cua-ban@gmail.com'), ',');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.email) = any (public.admin_emails())
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.site_config   enable row level security;

-- Mỗi người chỉ đọc được hồ sơ của chính mình.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Admin được sửa (chặn / bỏ chặn) hồ sơ của người khác.
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Ai cũng đọc được site_config để biết web có đang mở không.
-- (Nội dung không bí mật: chỉ là công tắc + lời nhắn.)
drop policy if exists site_config_public_read on public.site_config;
create policy site_config_public_read on public.site_config
  for select to anon, authenticated
  using (true);

drop policy if exists site_config_admin_write on public.site_config;
create policy site_config_admin_write on public.site_config
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Hàm công khai để trang web kiểm tra quyền truy cập
--    Trả về đúng 3 thứ cần biết, không lộ gì thêm.
-- ---------------------------------------------------------------------------
create or replace function public.access_state()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cfg       public.site_config;
  me        public.profiles;
begin
  select * into cfg from public.site_config where id = 1;
  if auth.uid() is not null then
    select * into me from public.profiles where id = auth.uid();
  end if;

  return json_build_object(
    'signed_in',  auth.uid() is not null,
    'is_admin',   auth.uid() is not null and lower(coalesce(me.email, '')) = any (public.admin_emails()),
    'blocked',    coalesce(me.blocked, false),
    'site_open',  coalesce(cfg.site_open, true),
    'message',    coalesce(cfg.maintenance_message, ''),
    'gemini_enabled', coalesce(cfg.gemini_enabled, true),
    'name',       me.full_name,
    'avatar',     me.avatar_url
  );
end;
$$;

grant execute on function public.access_state() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Điểm danh lần cuối (admin xem ai đang dùng)
-- ---------------------------------------------------------------------------
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;
