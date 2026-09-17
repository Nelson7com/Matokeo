-- Run this in Supabase SQL Editor. Authentication users are created in Supabase Auth.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('teacher', 'admin')) default 'teacher',
  created_at timestamptz not null default now()
);
create table if not exists public.submissions (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references public.profiles(id),
  class_name text not null, subject text not null, term text not null, year text not null,
  stream text not null default 'A', status text not null default 'Pending Admin',
  created_at timestamptz not null default now()
);
create table if not exists public.submission_rows (
  id bigint generated always as identity primary key,
  submission_id bigint not null references public.submissions(id) on delete cascade,
  name text not null, admission_no text, marks numeric not null check (marks >= 0 and marks <= 100)
);
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_rows enable row level security;
create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "teachers read own submissions" on public.submissions for select using (auth.uid() = teacher_id);
create policy "admins read all submissions" on public.submissions for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "teachers insert own submissions" on public.submissions for insert with check (auth.uid() = teacher_id);
create policy "admins approve submissions" on public.submissions for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "users read submission rows they can access" on public.submission_rows for select using (exists (select 1 from public.submissions s where s.id = submission_id and (s.teacher_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))));
create policy "teachers insert own submission rows" on public.submission_rows for insert with check (exists (select 1 from public.submissions s where s.id = submission_id and s.teacher_id = auth.uid()));
