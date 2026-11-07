drop policy proj_select on public.projects;
create policy proj_select on public.projects for select to authenticated using (customer_id = (select auth.uid()) or private.can_see_project(id));
