-- Expose only aggregate counts to the public website; never grant anon
-- direct read access to member, project, or affiliate records.
create or replace function public.get_public_website_statistics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'members', (select count(*) from public.members),
    'projects', (select count(*) from public.projects where archived = false),
    'branches', (select count(*) from public.branches where is_active = true),
    'affiliates', (select count(*) from public.affiliates where active = true)
  );
$$;

revoke all on function public.get_public_website_statistics() from public;
grant execute on function public.get_public_website_statistics() to anon, authenticated;

notify pgrst, 'reload schema';
