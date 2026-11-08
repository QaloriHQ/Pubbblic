-- Pubbblic prelaunch waitlist. Dedicated Supabase project recommended.
-- Apply only to the selected Pubbblic project after review.
create extension if not exists citext;
create table if not exists public.marketing_waitlist (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  audience text not null check (audience in ('business','startup','agency','other')),
  source text not null default 'site',
  consent_at timestamptz not null,
  consent_version text not null,
  subscribed boolean not null default true,
  email_step integer not null default 0 check (email_step >= 0),
  next_email_at timestamptz,
  last_email_at timestamptz,
  claim_until timestamptz,
  email_error text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists marketing_waitlist_due_idx on public.marketing_waitlist(next_email_at)
  where subscribed = true;
alter table public.marketing_waitlist enable row level security;
revoke all on table public.marketing_waitlist from anon, authenticated, public;
-- Service-role-only RPC; do not grant to public clients.
create or replace function public.claim_marketing_waitlist_batch(p_limit int default 10)
returns setof public.marketing_waitlist language plpgsql security definer
set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  return query
  with picked as (
    select m.id from public.marketing_waitlist m
    where m.subscribed=true and m.next_email_at <= now()
      and (m.claim_until is null or m.claim_until < now())
    order by m.next_email_at, m.created_at
    for update skip locked limit least(greatest(p_limit,1),20)
  )
  update public.marketing_waitlist m
  set claim_until=now()+interval '3 minutes'
  from picked where m.id=picked.id
  returning m.*;
end;
$$;
revoke all on function public.claim_marketing_waitlist_batch(int) from public,anon,authenticated;
grant execute on function public.claim_marketing_waitlist_batch(int) to service_role;
