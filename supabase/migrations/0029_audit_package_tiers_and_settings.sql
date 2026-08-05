-- LEANR — 0029: Extend the audit trigger to package_tiers and
-- system_settings -- Plan Management (create/edit/archive/delete a package)
-- and session-rule settings changes previously produced zero Activity Log
-- entries, unlike every other admin action.
create trigger audit_package_tiers after insert or update or delete on package_tiers
  for each row execute function fn_audit_trigger();

-- system_settings has no `id` column (its PK is `key text`), so it can't
-- reuse fn_audit_trigger() as-is (which reads new.id/old.id) -- this
-- variant passes entity_id = null; the changed key/value are still fully
-- captured in old_data/new_data via to_jsonb(row), same as every other
-- audited table.
create or replace function fn_audit_trigger_settings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, old_data, new_data)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    null,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_system_settings after insert or update or delete on system_settings
  for each row execute function fn_audit_trigger_settings();
