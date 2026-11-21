-- Scope branch staff to their assigned branch at the database boundary.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('sg', 'branch_admin', 'branch_secretary', 'treasurer', 'project_coordinator', 'events_manager'));

do $$
declare t text;
begin
  foreach t in array array['members','financial_records','projects','events','helpdesk_cases','efile_folders','efiles'] loop
    execute format('drop policy if exists "Internal users can manage %s" on public.%I', t, t);
    execute format('create policy "Internal users can manage %s" on public.%I for all to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null and (
        p.role = ''sg'' or (p.role in (''branch_admin'',''branch_secretary'') and (
          %I.branch_id = p.branch_id
        )) or p.role in (''treasurer'',''project_coordinator'',''events_manager'')
      ))
    ) with check (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null and (
        p.role = ''sg'' or (p.role in (''branch_admin'',''branch_secretary'') and (
          %I.branch_id = p.branch_id
        )) or p.role in (''treasurer'',''project_coordinator'',''events_manager'')
      ))
    )', t, t, t, t);
  end loop;
end $$;

drop policy if exists "Internal users can manage branches" on public.branches;
create policy "Internal users can manage branches" on public.branches for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null and
    (p.role in ('sg','treasurer','project_coordinator','events_manager') or
      (p.role in ('branch_admin','branch_secretary') and branches.id = p.branch_id))))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null and
    (p.role in ('sg','treasurer','project_coordinator','events_manager') or
      (p.role in ('branch_admin','branch_secretary') and branches.id = p.branch_id))));

-- Scope child records through their parent branch-owned record.
do $$
declare t text; parent_table text; parent_key text;
begin
  for t, parent_table, parent_key in values
    ('event_files','events','event_id'), ('event_invitations','events','event_id'),
    ('helpdesk_handlers','helpdesk_cases','case_id'), ('helpdesk_notes','helpdesk_cases','case_id'),
    ('helpdesk_documents','helpdesk_cases','case_id'), ('project_phases','projects','project_id'),
    ('project_team_members','projects','project_id'), ('project_resources','projects','project_id'), ('project_files','projects','project_id')
  loop
    execute format('drop policy if exists "Internal users can manage %s" on public.%I', t, t);
    execute format('drop policy if exists "Branch staff manage %s" on public.%I', t, t);
    execute format('create policy "Branch staff manage %s" on public.%I for all to authenticated using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null and (
        p.role = ''sg'' or p.role in (''treasurer'',''project_coordinator'',''events_manager'') or
        (p.role in (''branch_admin'',''branch_secretary'') and exists (
          select 1 from public.%I parent where parent.id = %I and parent.branch_id = p.branch_id
        ))
      ))
    ) with check (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.affiliate_id is null and (
        p.role = ''sg'' or p.role in (''treasurer'',''project_coordinator'',''events_manager'') or
        (p.role in (''branch_admin'',''branch_secretary'') and exists (
          select 1 from public.%I parent where parent.id = %I and parent.branch_id = p.branch_id
        ))
      ))
    )', t, t, parent_table, parent_key, parent_table, parent_key);
  end loop;
end $$;

-- Public website data: visible events are non-archived; downloads are public
-- through the event-files bucket's public URL.
drop policy if exists "Public can read active events" on public.events;
create policy "Public can read active events" on public.events
  for select to anon, authenticated using (archived = false);
drop policy if exists "Public can read files for active events" on public.event_files;
create policy "Public can read files for active events" on public.event_files
  for select to anon, authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.archived = false
  ));
grant select on public.events, public.event_files, public.branches to anon;
drop policy if exists "Public can read branches for registration" on public.branches;
create policy "Public can read branches for registration" on public.branches
  for select to anon using (is_active = true);

-- Public membership applications and grievances are inserted into the normal
-- operational tables and remain subject to ordinary authenticated policies.
grant insert on public.members, public.helpdesk_cases to anon;
drop policy if exists "Public can submit membership applications" on public.members;
create policy "Public can submit membership applications" on public.members
  for insert to anon with check (
    status = 'Provisional' and subscription_status = 'Pending'
    and branch_id is not null and name <> '' and email <> '' and phone <> ''
  );
drop policy if exists "Public can submit grievances" on public.helpdesk_cases;
create policy "Public can submit grievances" on public.helpdesk_cases
  for insert to anon with check (
    status = 'pending' and created_by is null and title <> '' and description <> ''
  );

notify pgrst, 'reload schema';
