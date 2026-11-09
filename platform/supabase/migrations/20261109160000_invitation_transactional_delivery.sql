-- Applied to Pubbblic project: invitation_transactional_delivery.
-- Provider telemetry does not change org permissions or expose secrets.
alter table public.organization_invitations
  add column if not exists notification_attempt_count integer not null default 0
    check (notification_attempt_count between 0 and 20),
  add column if not exists notification_delivery_provider text,
  add column if not exists notification_provider_message_id text,
  add column if not exists notification_last_error text;
comment on column public.organization_invitations.notification_sent_at is
  'Transactional provider accepted this invitation for processing; not guaranteed inbox delivery.';
