create schema if not exists private;
revoke all on schema private from public;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text not null check(char_length(btrim(name)) between 3 and 80),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.admin_roles(user_id uuid primary key references public.profiles(id) on delete cascade);
create table public.sectors(id uuid primary key default gen_random_uuid(),name text not null check(char_length(btrim(name)) between 3 and 80),description text not null default '' check(char_length(description)<=300),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index sectors_name_unique on public.sectors(lower(btrim(name)));
create table public.categories(id uuid primary key default gen_random_uuid(),name text not null check(char_length(btrim(name)) between 3 and 60),sector_id uuid not null references public.sectors(id),icon text not null check(icon in ('bulb','drop','accessibility','tool','building')),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index categories_name_unique on public.categories(lower(btrim(name)));
create index categories_sector on public.categories(sector_id);
create table public.sector_memberships(user_id uuid references public.profiles(id) on delete cascade,sector_id uuid references public.sectors(id),created_at timestamptz not null default now(),primary key(user_id,sector_id));
create index memberships_sector on public.sector_memberships(sector_id);
create table public.occurrences(id uuid primary key default gen_random_uuid(),number bigint generated always as identity unique,author_id uuid not null references public.profiles(id),category_id uuid not null references public.categories(id),sector_id uuid not null references public.sectors(id),status text not null default 'registrada' check(status in ('registrada','analise','andamento','resolvida','encerrada')),description text not null check(char_length(btrim(description)) between 10 and 1500),latitude numeric not null check(latitude between -20.774 and -20.750),longitude numeric not null check(longitude between -42.879 and -42.853),location_name text not null default '' check(char_length(location_name)<=160),reference text not null default '' check(char_length(reference)<=160),location_source text not null default 'coordinates' check(location_source in ('coordinates','photon','manual')),geocoder_metadata jsonb check(octet_length(geocoder_metadata::text)<=8192),photo_path text unique,request_id uuid not null,request_payload jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz,unique(author_id,request_id),check((status='resolvida')=(resolved_at is not null)));
create index occurrences_queue on public.occurrences(sector_id,status,created_at desc,id desc);
create index occurrences_date on public.occurrences(created_at desc,id desc);
create index occurrences_author on public.occurrences(author_id,created_at desc,id desc);
create index occurrences_category on public.occurrences(category_id);
create index occurrences_resolved on public.occurrences(resolved_at) where resolved_at is not null;
create table public.confirmations(occurrence_id uuid references public.occurrences(id),user_id uuid references public.profiles(id),created_at timestamptz not null default now(),primary key(occurrence_id,user_id));
create index confirmations_user on public.confirmations(user_id,occurrence_id);
create table public.contributions(id uuid primary key default gen_random_uuid(),occurrence_id uuid not null references public.occurrences(id),author_id uuid not null references public.profiles(id),body text not null check(char_length(btrim(body)) between 5 and 1500),request_id uuid not null,created_at timestamptz not null default now(),unique(author_id,request_id));
create index contributions_occurrence on public.contributions(occurrence_id,created_at,id);
create table public.occurrence_events(id uuid primary key default gen_random_uuid(),occurrence_id uuid not null references public.occurrences(id),actor_id uuid not null references public.profiles(id),type text not null check(type in ('created','confirmed','contribution','transition','transfer')),previous_status text,new_status text,previous_sector_id uuid references public.sectors(id),new_sector_id uuid references public.sectors(id),note text not null default '',created_at timestamptz not null default now());
create index events_occurrence on public.occurrence_events(occurrence_id,created_at,id);
create index events_actor on public.occurrence_events(actor_id);
create index contributions_author on public.contributions(author_id);
create function private.require_user() returns uuid language plpgsql security definer set search_path='' as $$declare u uuid:=auth.uid();begin if u is null or not exists(select 1 from public.profiles where id=u) then raise exception 'Authentication required' using errcode='42501';end if;return u;end$$;
create function private.require_admin() returns uuid language plpgsql security definer set search_path='' as $$declare u uuid:=private.require_user();begin if not exists(select 1 from public.admin_roles where user_id=u) then raise exception 'Administrator required' using errcode='42501';end if;return u;end$$;
-- One advisory lock coordinates catalog writes, new demands and membership replacement.
-- Row locks independently serialize actions on an existing occurrence.
create function private.catalog_lock() returns void language sql set search_path='' as $$select pg_advisory_xact_lock(7323230001)$$;
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id,name) values(new.id,coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),'Novo membro'));return new;end$$;
create trigger auth_user_profile after insert on auth.users for each row execute function private.new_profile();
create function public.update_profile(p_name text) returns public.profiles language plpgsql security definer set search_path='' as $$declare r public.profiles;begin update public.profiles set name=btrim(p_name),updated_at=now() where id=private.require_user() returning * into r;return r;end$$;
create function public.create_occurrence(p_request_id uuid,p_category_id uuid,p_description text,p_latitude numeric,p_longitude numeric,p_location_name text default '',p_reference text default '',p_location_source text default 'coordinates',p_geocoder_metadata jsonb default null,p_photo_path text default null) returns public.occurrences language plpgsql security definer set search_path='' as $$declare u uuid:=private.require_user();r public.occurrences;c public.categories;s public.sectors;payload jsonb;obj storage.objects;begin
 perform private.catalog_lock();
 payload:=jsonb_build_object('category',p_category_id,'description',p_description,'latitude',p_latitude,'longitude',p_longitude,'location_name',p_location_name,'reference',p_reference,'location_source',p_location_source,'geocoder_metadata',p_geocoder_metadata,'photo_path',p_photo_path);
 select * into r from public.occurrences where author_id=u and request_id=p_request_id;
 if found then if r.request_payload<>payload then raise exception 'Request identifier reused' using errcode='23505';end if;return r;end if;
 select * into c from public.categories where id=p_category_id;
 if not found then raise exception 'Category not found' using errcode='P0002';end if;
 select * into s from public.sectors where id=c.sector_id;
 if not c.active or not s.active then raise exception 'Inactive category or sector' using errcode='23505';end if;
 if p_photo_path is not null then
  if split_part(p_photo_path,'/',1)<>u::text then raise exception 'Photo ownership mismatch' using errcode='42501';end if;
  select * into obj from storage.objects where bucket_id='occurrence-photos' and name=p_photo_path for update;
  if not found then raise exception 'Photo not found' using errcode='22023';end if;
  if obj.created_at<=now()-interval '24 hours' then raise exception 'Photo upload expired' using errcode='22023';end if;
  if coalesce(obj.metadata->>'mimetype','') not in ('image/jpeg','image/png','image/webp') or coalesce((obj.metadata->>'size')::bigint,0) not between 1 and 2097152 then raise exception 'Invalid photo' using errcode='22023';end if;
 end if;
 insert into public.occurrences(author_id,category_id,sector_id,description,latitude,longitude,location_name,reference,location_source,geocoder_metadata,photo_path,request_id,request_payload) values(u,c.id,c.sector_id,btrim(p_description),p_latitude,p_longitude,p_location_name,p_reference,p_location_source,p_geocoder_metadata,p_photo_path,p_request_id,payload) returning * into r;
 insert into public.occurrence_events(occurrence_id,actor_id,type,new_status,new_sector_id) values(r.id,u,'created',r.status,r.sector_id);return r;end$$;
create function public.confirm_occurrence(p_occurrence_id uuid) returns boolean language plpgsql security definer set search_path='' as $$declare u uuid:=private.require_user();n int;begin
 if not exists(select 1 from public.occurrences where id=p_occurrence_id) then raise exception 'Occurrence not found' using errcode='P0002';end if;
 insert into public.confirmations(occurrence_id,user_id) values(p_occurrence_id,u) on conflict do nothing;get diagnostics n=row_count;
 if n=1 then insert into public.occurrence_events(occurrence_id,actor_id,type) values(p_occurrence_id,u,'confirmed');end if;return n=1;end$$;
create function public.add_contribution(p_occurrence_id uuid,p_request_id uuid,p_body text) returns public.contributions language plpgsql security definer set search_path='' as $$declare u uuid:=private.require_user();r public.contributions;begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
 select * into r from public.contributions where author_id=u and request_id=p_request_id;
 if found then if r.occurrence_id is distinct from p_occurrence_id or r.body is distinct from btrim(p_body) then raise exception 'Request identifier reused' using errcode='23505';end if;return r;end if;
 if not exists(select 1 from public.occurrences where id=p_occurrence_id) then raise exception 'Occurrence not found' using errcode='P0002';end if;
 insert into public.contributions(occurrence_id,author_id,body,request_id) values(p_occurrence_id,u,btrim(p_body),p_request_id) returning * into r;
 insert into public.occurrence_events(occurrence_id,actor_id,type,note) values(p_occurrence_id,u,'contribution',r.body);return r;end$$;
create function private.lock_occurrence(p_id uuid,p_status text,p_sector uuid) returns public.occurrences language plpgsql security definer set search_path='' as $$declare u uuid:=private.require_user();r public.occurrences;begin
 perform private.catalog_lock();select * into r from public.occurrences where id=p_id for update;
 if not found then raise exception 'Occurrence not found' using errcode='P0002';end if;
 if not exists(select 1 from public.sector_memberships where user_id=u and sector_id=r.sector_id) then raise exception 'Sector membership required' using errcode='42501';end if;
 if r.status is distinct from p_status or r.sector_id is distinct from p_sector then raise exception 'Occurrence has changed' using errcode='40001';end if;return r;end$$;
create function public.transition_occurrence(p_occurrence_id uuid,p_expected_status text,p_expected_sector_id uuid,p_status text,p_note text default '') returns public.occurrences language plpgsql security definer set search_path='' as $$declare r public.occurrences;old_status text;begin
 r:=private.lock_occurrence(p_occurrence_id,p_expected_status,p_expected_sector_id);old_status:=r.status;
 if not ((r.status='registrada' and p_status in ('analise','encerrada')) or (r.status='analise' and p_status in ('andamento','encerrada')) or (r.status='andamento' and p_status='resolvida')) or p_status is null then raise exception 'Invalid status transition' using errcode='22023';end if;
 if p_note is null or char_length(btrim(p_note))>1500 or (p_status in ('resolvida','encerrada') and char_length(btrim(p_note))<10) then raise exception 'Invalid action note' using errcode='22023';end if;
 update public.occurrences set status=p_status,updated_at=now(),resolved_at=case when p_status='resolvida' then now() else null end where id=r.id returning * into r;
 insert into public.occurrence_events(occurrence_id,actor_id,type,previous_status,new_status,note) values(r.id,auth.uid(),'transition',old_status,p_status,btrim(p_note));return r;end$$;
create function public.transfer_occurrence(p_occurrence_id uuid,p_expected_status text,p_expected_sector_id uuid,p_sector_id uuid,p_reason text) returns public.occurrences language plpgsql security definer set search_path='' as $$declare r public.occurrences;begin
 r:=private.lock_occurrence(p_occurrence_id,p_expected_status,p_expected_sector_id);
 if r.status not in ('registrada','analise') or p_sector_id=r.sector_id then raise exception 'Invalid transfer' using errcode='22023';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 10 and 1500 then raise exception 'Invalid transfer reason' using errcode='22023';end if;
 if not exists(select 1 from public.sectors where id=p_sector_id and active) then raise exception 'Inactive target sector' using errcode='23505';end if;
 update public.occurrences set sector_id=p_sector_id,updated_at=now() where id=r.id returning * into r;
 insert into public.occurrence_events(occurrence_id,actor_id,type,previous_sector_id,new_sector_id,note) values(r.id,auth.uid(),'transfer',p_expected_sector_id,p_sector_id,btrim(p_reason));return r;end$$;
create function public.save_sector(p_name text,p_description text default '',p_active boolean default true,p_id uuid default null) returns public.sectors language plpgsql security definer set search_path='' as $$declare r public.sectors;begin
 perform private.require_admin();perform private.catalog_lock();
 if p_id is not null then
  if not exists(select 1 from public.sectors where id=p_id) then raise exception 'Sector not found' using errcode='P0002';end if;
  if not p_active and (exists(select 1 from public.categories where sector_id=p_id and active) or exists(select 1 from public.occurrences where sector_id=p_id and status not in ('resolvida','encerrada'))) then raise exception 'Sector has active references' using errcode='23505';end if;
  update public.sectors set name=btrim(p_name),description=p_description,active=p_active,updated_at=now() where id=p_id returning * into r;
 else insert into public.sectors(name,description,active) values(btrim(p_name),p_description,p_active) returning * into r;end if;return r;end$$;
create function public.save_category(p_name text,p_sector_id uuid,p_icon text default 'tool',p_active boolean default true,p_id uuid default null) returns public.categories language plpgsql security definer set search_path='' as $$declare r public.categories;begin
 perform private.require_admin();perform private.catalog_lock();
 if not exists(select 1 from public.sectors where id=p_sector_id and active) then
  if p_id is null or p_active or not exists(select 1 from public.categories where id=p_id and sector_id=p_sector_id) then raise exception 'Inactive target sector' using errcode='23505';end if;
 end if;
 if p_id is not null then update public.categories set name=btrim(p_name),sector_id=p_sector_id,icon=p_icon,active=p_active,updated_at=now() where id=p_id returning * into r;if not found then raise exception 'Category not found' using errcode='P0002';end if;
 else insert into public.categories(name,sector_id,icon,active) values(btrim(p_name),p_sector_id,p_icon,p_active) returning * into r;end if;return r;end$$;
create function public.set_user_sectors(p_user_id uuid,p_sector_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$begin
 perform private.require_admin();perform private.catalog_lock();
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'User not found' using errcode='P0002';end if;
 if p_sector_ids is null or exists(select 1 from unnest(p_sector_ids) x where x is null or not exists(select 1 from public.sectors s where s.id=x and (s.active or exists(select 1 from public.sector_memberships m where m.user_id=p_user_id and m.sector_id=s.id)))) then raise exception 'Invalid or inactive sector' using errcode='22023';end if;
 delete from public.sector_memberships where user_id=p_user_id and not(sector_id=any(p_sector_ids));
 insert into public.sector_memberships(user_id,sector_id) select p_user_id,x from unnest(p_sector_ids) x on conflict do nothing;end$$;
create function public.list_admin_users(p_search text default '',p_limit int default 50,p_after_id uuid default null) returns table(id uuid,name text,email text,sector_ids uuid[]) language plpgsql security definer set search_path='' as $$begin
 perform private.require_admin();if p_limit not between 1 and 101 then raise exception 'Invalid limit' using errcode='22023';end if;
 return query select p.id,p.name,u.email::text,coalesce((select array_agg(m.sector_id order by m.sector_id) from public.sector_memberships m where m.user_id=p.id),'{}'::uuid[]) from public.profiles p join auth.users u on u.id=p.id where (p_after_id is null or p.id>p_after_id) and (p.name ilike '%'||p_search||'%' or u.email ilike '%'||p_search||'%') order by p.id limit p_limit;end$$;
create function public.get_statistics(p_start date,p_end date) returns jsonb language plpgsql security definer set search_path='' as $$declare a timestamptz;b timestamptz;r jsonb;begin
 perform private.require_user();if p_start is null or p_end is null or p_end<p_start then raise exception 'Invalid period' using errcode='22023';end if;
 a:=p_start::timestamp at time zone 'America/Sao_Paulo';b:=(p_end+1)::timestamp at time zone 'America/Sao_Paulo';
 with period as(select * from public.occurrences where created_at>=a and created_at<b),resolved as(select * from public.occurrences where resolved_at>=a and resolved_at<b)
 select jsonb_build_object('total',(select count(*) from period),'byStatus',coalesce((select jsonb_agg(t) from(select status,count(*) from period group by status order by status)t),'[]'::jsonb),'byCategory',coalesce((select jsonb_agg(t) from(select category_id,count(*) from period group by category_id order by category_id)t),'[]'::jsonb),'bySector',coalesce((select jsonb_agg(t) from(select sector_id,count(*) from period group by sector_id order by sector_id)t),'[]'::jsonb),'resolvedCount',(select count(*) from resolved),'averageResolutionHours',(select avg(extract(epoch from(resolved_at-created_at))/3600) from resolved)) into r;return r;end$$;
-- Grant read-only tables. Every mutation runs through a restricted transaction RPC.
do $$declare t text;begin foreach t in array array['profiles','sectors','categories','sector_memberships','occurrences','confirmations','contributions','occurrence_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy authenticated_read on public.%I for select to authenticated using (auth.uid() is not null)',t);
 end loop;end$$;
alter table public.admin_roles enable row level security;
revoke all on public.admin_roles from anon,authenticated;
grant select on public.admin_roles to authenticated;
create policy own_admin_role on public.admin_roles for select to authenticated using(user_id=auth.uid());
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.update_profile(text),public.create_occurrence(uuid,uuid,text,numeric,numeric,text,text,text,jsonb,text),public.confirm_occurrence(uuid),public.add_contribution(uuid,uuid,text),public.transition_occurrence(uuid,text,uuid,text,text),public.transfer_occurrence(uuid,text,uuid,uuid,text),public.save_sector(text,text,boolean,uuid),public.save_category(text,uuid,text,boolean,uuid),public.set_user_sectors(uuid,uuid[]),public.list_admin_users(text,int,uuid),public.get_statistics(date,date) to authenticated;
-- No public storage URLs. Inserts are immutable and scoped to the account directory.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('occurrence-photos','occurrence-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy own_photo_insert on storage.objects for insert to authenticated with check(bucket_id='occurrence-photos' and split_part(name,'/',1)=auth.uid()::text);
create policy linked_photo_read on storage.objects for select to authenticated using(bucket_id='occurrence-photos' and (split_part(name,'/',1)=auth.uid()::text or exists(select 1 from public.occurrences o where o.photo_path=name)));
create policy unlinked_photo_delete on storage.objects for delete to authenticated using(bucket_id='occurrence-photos' and split_part(name,'/',1)=auth.uid()::text and not exists(select 1 from public.occurrences o where o.photo_path=name));
-- Serialize deleting an upload against attaching it, including Storage service calls.
create function private.protect_photo_delete() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.bucket_id='occurrence-photos' and exists(select 1 from public.occurrences where photo_path=old.name) then raise exception 'Photo is attached to an occurrence' using errcode='42501';end if;return old;end$$;
create trigger protect_attached_photo before delete on storage.objects for each row execute function private.protect_photo_delete();
revoke all on function private.protect_photo_delete() from public,anon,authenticated;
