-- Read-only structural verification after migration is applied to the dedicated Pubbblic project.
-- This does NOT replace authenticated cross-tenant integration tests.
select tablename, rowsecurity
from pg_tables
where schemaname='public'
and tablename in ('organizations','organization_memberships','organization_invitations',
                 'press_releases','press_release_versions','press_release_media')
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where (schemaname='public'
  and tablename in ('organizations','organization_memberships','organization_invitations',
                    'press_releases','press_release_versions','press_release_media'))
or (schemaname='storage' and tablename='objects' and policyname like 'pubbblic_%')
order by schemaname,tablename,policyname;

select id,public,file_size_limit,allowed_mime_types
from storage.buckets where id='release-assets';

select table_name,privilege_type,grantee
from information_schema.role_table_grants
where table_schema='public'
and table_name in ('organizations','organization_memberships','organization_invitations',
                   'press_releases','press_release_versions','press_release_media')
and grantee in ('anon','authenticated')
order by table_name,grantee,privilege_type;
