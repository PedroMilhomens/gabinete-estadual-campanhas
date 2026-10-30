revoke insert, delete on table public.audit_log
from public, anon, authenticated, service_role;

revoke update on table public.audit_log
from public, anon, authenticated;

grant update on table public.audit_log to service_role;
