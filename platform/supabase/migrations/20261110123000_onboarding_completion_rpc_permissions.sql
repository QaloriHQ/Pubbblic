-- Grant controlled, authenticated access to the private step-completion routine.
-- The private implementation verifies auth.uid(), successful password setup,
-- and current organization membership; no user can mark the password step.
create or replace function public.complete_onboarding_invitations()
returns void
language sql security definer set search_path = ''
as $$select private.complete_user_onboarding_invitations();$$;
revoke all on function public.complete_onboarding_invitations() from public, anon;
grant execute on function public.complete_onboarding_invitations() to authenticated;
