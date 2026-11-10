-- Team invitations are optional. Marking the team step is UI progress only;
-- password_set_at remains server-owned and is never writable by clients.
grant update (invitations_reviewed_at) on public.user_onboarding to authenticated;
drop policy if exists pubbblic_update_own_team_onboarding on public.user_onboarding;
create policy pubbblic_update_own_team_onboarding on public.user_onboarding
  for update to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));
