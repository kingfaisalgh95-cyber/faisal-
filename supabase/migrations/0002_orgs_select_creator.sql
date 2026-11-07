drop policy orgs_select on public.organizations;
create policy orgs_select on public.organizations for select to authenticated using (created_by = (select auth.uid()) or private.is_member(id) or private.org_linked_to_my_project(id));
