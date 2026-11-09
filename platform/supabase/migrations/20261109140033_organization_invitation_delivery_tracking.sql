-- Applied to Pubbblic Project as migration 20261109140033.
-- Adds delivery tracking without widening existing invitation RLS.
alter table public.organization_invitations
  add column if not exists notification_last_attempt_at timestamptz,
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_state text not null default 'not_sent'
    check (notification_state in ('not_sent','sending','sent','failed')),
  add column if not exists notification_send_count integer not null default 0
    check (notification_send_count between 0 and 20);
comment on column public.organization_invitations.notification_sent_at is
  'Set only after Supabase Auth accepted a sign-in/confirmation email request. Does not certify inbox delivery.';
