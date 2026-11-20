create table if not exists public.articles (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  content text not null,
  category text not null default 'General',
  published boolean not null default false,
  featured_image_path text,
  featured_image_caption text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_attachments (
  id text primary key default gen_random_uuid()::text,
  article_id text not null references public.articles(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  caption text not null default '',
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('article-media', 'article-media', true)
on conflict (id) do update set public = true;

alter table public.articles enable row level security;
alter table public.article_attachments enable row level security;

drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles" on public.articles
for select to anon, authenticated using (published = true);

drop policy if exists "Internal users can manage articles" on public.articles;
create policy "Internal users can manage articles" on public.articles
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null));

drop policy if exists "Public can read published article attachments" on public.article_attachments;
create policy "Public can read published article attachments" on public.article_attachments
for select to anon, authenticated using (
  exists (select 1 from public.articles a where a.id = article_id and a.published = true)
);

drop policy if exists "Internal users can manage article attachments" on public.article_attachments;
create policy "Internal users can manage article attachments" on public.article_attachments
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null));

drop policy if exists "Anyone can read article media" on storage.objects;
create policy "Anyone can read article media" on storage.objects
for select to anon, authenticated using (bucket_id = 'article-media');

drop policy if exists "Internal users can upload article media" on storage.objects;
create policy "Internal users can upload article media" on storage.objects
for insert to authenticated with check (
  bucket_id = 'article-media' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null
  )
);

drop policy if exists "Internal users can delete article media" on storage.objects;
create policy "Internal users can delete article media" on storage.objects
for delete to authenticated using (
  bucket_id = 'article-media' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null
  )
);