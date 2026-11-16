-- Only another account can corroborate an occurrence. Preserve append-only
-- history and the existing per-account idempotent confirmation behavior.
create or replace function public.confirm_occurrence(p_occurrence_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := private.require_user();
  occurrence_author uuid;
  inserted_count integer;
begin
  select author_id into occurrence_author
  from public.occurrences
  where id = p_occurrence_id;

  if not found then
    raise exception 'Occurrence not found' using errcode = 'P0002';
  end if;

  if occurrence_author = u then
    raise exception 'Authors cannot confirm their own occurrence'
      using errcode = '42501';
  end if;

  insert into public.confirmations(occurrence_id, user_id)
  values (p_occurrence_id, u)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    insert into public.occurrence_events(occurrence_id, actor_id, type)
    values (p_occurrence_id, u, 'confirmed');
  end if;

  return inserted_count = 1;
end;
$$;

-- CREATE OR REPLACE preserves privileges; state the intended grants explicitly.
revoke all on function public.confirm_occurrence(uuid) from public, anon;
grant execute on function public.confirm_occurrence(uuid) to authenticated;
