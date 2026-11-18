-- Merge partial edits under the same transaction lock used by save_sector and
-- save_category so catalog invariants and concurrent changes are preserved.
create function public.patch_sector(
  p_id uuid, p_name text default null, p_description text default null,
  p_active boolean default null
) returns public.sectors language plpgsql security definer set search_path = '' as $$
declare
  current_sector public.sectors;
begin
  perform private.require_admin();
  if coalesce(p_name, p_description) is null and p_active is null then
    raise exception 'Empty sector patch' using errcode = '22023';
  end if;
  perform private.catalog_lock();
  select * into strict current_sector from public.sectors where id = p_id;
  return public.save_sector(
    coalesce(p_name, current_sector.name),
    coalesce(p_description, current_sector.description),
    coalesce(p_active, current_sector.active), p_id
  );
end
$$;

create function public.patch_category(
  p_id uuid, p_name text default null, p_sector_id uuid default null,
  p_icon text default null, p_active boolean default null
) returns public.categories language plpgsql security definer set search_path = '' as $$
declare
  current_category public.categories;
begin
  perform private.require_admin();
  if coalesce(p_name, p_icon) is null and p_sector_id is null and p_active is null then
    raise exception 'Empty category patch' using errcode = '22023';
  end if;
  perform private.catalog_lock();
  select * into strict current_category from public.categories where id = p_id;
  return public.save_category(
    coalesce(p_name, current_category.name),
    coalesce(p_sector_id, current_category.sector_id),
    coalesce(p_icon, current_category.icon),
    coalesce(p_active, current_category.active), p_id
  );
end
$$;

revoke all on function public.patch_sector(uuid,text,text,boolean),
  public.patch_category(uuid,text,uuid,text,boolean) from public, anon;
grant execute on function public.patch_sector(uuid,text,text,boolean),
  public.patch_category(uuid,text,uuid,text,boolean) to authenticated;
