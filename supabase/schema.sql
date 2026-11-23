-- ============================================================================
-- SMK Prima Unggul — Supabase PostgreSQL Schema, Triggers & RLS (Idempotent)
-- Jalankan seluruh skrip ini di Supabase SQL Editor. Aman dijalankan ulang.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Pastikan hak akses dasar schema public tersedia
grant usage on schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. Fungsi Trigger updated_at Otomatis
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Tabel Profil Karyawan (sinkron 1:1 dengan auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  nip text not null default '',
  role text not null check (role in ('admin', 'guru', 'tenaga_kependidikan')),
  jabatan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Trigger Otomatis User Baru (User pertama otomatis menjadi 'admin')
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  has_existing_profile boolean;
  assigned_role text;
  user_email text;
begin
  -- Cegah race condition saat pendaftaran user pertama bersamaan
  perform pg_advisory_xact_lock(hashtext('public.profiles_first_user_lock'));

  select exists(select 1 from public.profiles limit 1) into has_existing_profile;

  if not has_existing_profile then
    assigned_role := 'admin';
  else
    assigned_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'tenaga_kependidikan');
    if assigned_role not in ('admin', 'guru', 'tenaga_kependidikan') then
      assigned_role := 'tenaga_kependidikan';
    end if;
  end if;

  user_email := coalesce(nullif(lower(trim(new.email)), ''), new.id::text || '@local.user');

  insert into public.profiles (id, email, full_name, nip, role, jabatan)
  values (
    new.id,
    user_email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(user_email, '@', 1)),
    coalesce(trim(new.raw_user_meta_data->>'nip'), ''),
    assigned_role,
    coalesce(trim(new.raw_user_meta_data->>'jabatan'), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    nip = excluded.nip,
    role = excluded.role,
    jabatan = excluded.jabatan,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill aman jika sudah ada user di auth.users sebelum skrip ini dijalankan
do $$
declare
  first_user_id uuid;
begin
  select id into first_user_id
  from auth.users
  order by created_at asc
  limit 1;

  if first_user_id is not null then
    insert into public.profiles (id, email, full_name, nip, role, jabatan)
    select
      u.id,
      coalesce(nullif(lower(trim(u.email)), ''), u.id::text || '@local.user'),
      coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(u.email, 'user'), '@', 1)),
      coalesce(trim(u.raw_user_meta_data->>'nip'), ''),
      case
        when u.id = first_user_id and not exists (select 1 from public.profiles where role = 'admin') then 'admin'
        when coalesce(u.raw_user_meta_data->>'role', '') in ('admin', 'guru', 'tenaga_kependidikan')
          then u.raw_user_meta_data->>'role'
        else 'tenaga_kependidikan'
      end,
      coalesce(trim(u.raw_user_meta_data->>'jabatan'), '')
    from auth.users u
    where not exists (select 1 from public.profiles p where p.id = u.id)
    on conflict (id) do nothing;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Tabel Data Siswa
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  nama text not null,
  kelas text not null,
  jurusan text not null check (jurusan in ('TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_jurusan_kelas on public.students(jurusan, kelas);

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at
  before update on public.students
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Tabel Absensi Karyawan (Admin, Guru, Tenaga Kependidikan)
-- ----------------------------------------------------------------------------
create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default (now() at time zone 'Asia/Jakarta')::date,
  check_in_time text,
  check_out_time text,
  status text not null check (status in ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_emp_attendance_date on public.employee_attendance(date desc);
create index if not exists idx_emp_attendance_user_date on public.employee_attendance(user_id, date desc);

drop trigger if exists trg_employee_attendance_updated_at on public.employee_attendance;
create trigger trg_employee_attendance_updated_at
  before update on public.employee_attendance
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Tabel Absensi Siswa
-- ----------------------------------------------------------------------------
create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  recorded_by uuid references public.profiles(id) on delete set null,
  date date not null default (now() at time zone 'Asia/Jakarta')::date,
  status text not null check (status in ('Hadir', 'Izin', 'Sakit', 'Alpa')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

create index if not exists idx_stu_attendance_date on public.student_attendance(date desc);
create index if not exists idx_stu_attendance_student_date on public.student_attendance(student_id, date desc);

drop trigger if exists trg_student_attendance_updated_at on public.student_attendance;
create trigger trg_student_attendance_updated_at
  before update on public.student_attendance
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. Row Level Security (RLS) & Policies (Idempoten)
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.student_attendance enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Profiles policies
drop policy if exists "Users can view own profile or admin views all" on public.profiles;
create policy "Users can view own profile or admin views all"
  on public.profiles for select
  using (auth.uid() = id or public.current_user_role() = 'admin');

drop policy if exists "Admin can insert profiles" on public.profiles;
create policy "Admin can insert profiles"
  on public.profiles for insert
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin can update profiles" on public.profiles;
create policy "Admin can update profiles"
  on public.profiles for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin can delete profiles" on public.profiles;
create policy "Admin can delete profiles"
  on public.profiles for delete
  using (public.current_user_role() = 'admin');

-- Students policies
drop policy if exists "Authenticated staff can view students" on public.students;
create policy "Authenticated staff can view students"
  on public.students for select
  using (auth.uid() is not null);

drop policy if exists "Admin can insert students" on public.students;
create policy "Admin can insert students"
  on public.students for insert
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin can update students" on public.students;
create policy "Admin can update students"
  on public.students for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin can delete students" on public.students;
create policy "Admin can delete students"
  on public.students for delete
  using (public.current_user_role() = 'admin');

-- Employee attendance policies
drop policy if exists "Staff can view own attendance and admin views all" on public.employee_attendance;
create policy "Staff can view own attendance and admin views all"
  on public.employee_attendance for select
  using (auth.uid() = user_id or public.current_user_role() = 'admin');

drop policy if exists "Staff can insert own attendance" on public.employee_attendance;
create policy "Staff can insert own attendance"
  on public.employee_attendance for insert
  with check (auth.uid() = user_id or public.current_user_role() = 'admin');

drop policy if exists "Staff can update own attendance" on public.employee_attendance;
create policy "Staff can update own attendance"
  on public.employee_attendance for update
  using (auth.uid() = user_id or public.current_user_role() = 'admin')
  with check (auth.uid() = user_id or public.current_user_role() = 'admin');

drop policy if exists "Admin can delete employee attendance" on public.employee_attendance;
create policy "Admin can delete employee attendance"
  on public.employee_attendance for delete
  using (public.current_user_role() = 'admin');

-- Student attendance policies
drop policy if exists "Admin and Guru can view student attendance" on public.student_attendance;
create policy "Admin and Guru can view student attendance"
  on public.student_attendance for select
  using (public.current_user_role() in ('admin', 'guru'));

drop policy if exists "Admin and Guru can record student attendance" on public.student_attendance;
create policy "Admin and Guru can record student attendance"
  on public.student_attendance for insert
  with check (public.current_user_role() in ('admin', 'guru'));

drop policy if exists "Admin and Guru can update student attendance" on public.student_attendance;
create policy "Admin and Guru can update student attendance"
  on public.student_attendance for update
  using (public.current_user_role() in ('admin', 'guru'))
  with check (public.current_user_role() in ('admin', 'guru'));

drop policy if exists "Admin can delete student attendance" on public.student_attendance;
create policy "Admin can delete student attendance"
  on public.student_attendance for delete
  using (public.current_user_role() = 'admin');

-- Grant table & sequence access
grant all on public.profiles to service_role;
grant all on public.students to service_role;
grant all on public.employee_attendance to service_role;
grant all on public.student_attendance to service_role;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.employee_attendance to authenticated;
grant select, insert, update, delete on public.student_attendance to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Seed Awal Data Siswa SMK Prima Unggul (Idempoten)
-- ----------------------------------------------------------------------------
insert into public.students (nis, nama, kelas, jurusan) values
  ('202601001', 'Aditya Pratama', 'X TKJ 1', 'TKJ'),
  ('202601002', 'Aulia Rahmawati', 'X TKJ 1', 'TKJ'),
  ('202601003', 'Bagas Kurniawan', 'XI TKJ 1', 'TKJ'),
  ('202601004', 'Citra Dewi Lestari', 'X DKV 1', 'DKV'),
  ('202601005', 'Dimas Saputra', 'XI DKV 1', 'DKV'),
  ('202601006', 'Elsa Nurlita', 'XII DKV 1', 'DKV'),
  ('202601007', 'Fajar Hidayat', 'X AK 1', 'AK'),
  ('202601008', 'Gita Permatasari', 'XI AK 1', 'AK'),
  ('202601009', 'Hendra Wijaya', 'X BC 1', 'BC'),
  ('202601010', 'Intan Kusuma', 'XI BC 1', 'BC'),
  ('202601011', 'Joko Susilo', 'X MPLB 1', 'MPLB'),
  ('202601012', 'Kartika Sari', 'XI MPLB 1', 'MPLB'),
  ('202601013', 'Lutfi Hakim', 'X BD 1', 'BD'),
  ('202601014', 'Maya Anggraini', 'XII BD 1', 'BD')
on conflict (nis) do nothing;
