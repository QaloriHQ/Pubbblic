-- Invited-team onboarding is now completed via a trusted Supabase Edge Function.
-- Do not expose an authenticated SECURITY DEFINER RPC in the Data API.
drop function if exists public.complete_onboarding_invitations();
drop function if exists private.complete_user_onboarding_invitations();
