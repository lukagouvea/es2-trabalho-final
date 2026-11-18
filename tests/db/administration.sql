\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('12000000-0000-0000-0000-000000000001','admin2@test.invalid','{"name":"Admin Two"}'),
('12000000-0000-0000-0000-000000000002','staff2@test.invalid','{"name":"Staff Two"}');
insert into admin_roles values('12000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000001',true);
do $$declare a public.sectors;b public.sectors;c public.categories;o public.occurrences;stats jsonb;begin
 a:=save_sector('Admin Sector');b:=save_sector('Other Admin Sector');
 begin perform save_sector('admin sector');raise exception 'Case insensitive name uniqueness missing';exception when unique_violation then null;end;
 c:=save_category('Admin Category',a.id,'bulb');
 perform set_user_sectors('12000000-0000-0000-0000-000000000002',array[a.id]);
 o:=create_occurrence(gen_random_uuid(),c.id,'Demand in the administration test',-20.76,-42.86);
 begin perform transition_occurrence(o.id,'registrada',a.id,'analise');raise exception 'Administrator bypassed membership';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000002',true);
 o:=transfer_occurrence(o.id,'registrada',a.id,b.id,'Correct destination for this demand');
 if o.status<>'registrada' or o.sector_id<>b.id then raise exception 'Transfer lost state';end if;
 begin perform transition_occurrence(o.id,'registrada',b.id,'analise');raise exception 'Staff acted outside membership';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000001',true);
 perform set_user_sectors('12000000-0000-0000-0000-000000000002',array[b.id]);
 perform save_category(c.name,b.id,c.icon,true,c.id);
 perform save_sector(a.name,'',false,a.id);
 begin perform set_user_sectors('12000000-0000-0000-0000-000000000002',array[a.id]);raise exception 'Inactive sector received membership';exception when invalid_parameter_value then null;end;
 begin perform save_sector(b.name,'',false,b.id);raise exception 'Sector with open demand deactivated';exception when unique_violation then null;end;
 a:=patch_sector(a.id,p_description=>'Descrição preservada');
 a:=patch_sector(a.id,p_name=>'Setor renomeado');
 if a.active or a.description<>'Descrição preservada' then raise exception 'Partial rename changed sector fields';end if;
 c:=patch_category(c.id,p_active=>false);
 c:=patch_category(c.id,p_name=>'Categoria renomeada');
 if c.active or c.icon<>'bulb' or c.sector_id<>b.id then raise exception 'Partial rename changed category fields';end if;
 begin perform patch_sector(b.id,p_active=>false);raise exception 'Partial edit bypassed open demand restriction';exception when unique_violation then null;end;
 perform update_profile('Updated Name');
 if (select name from profiles where id=auth.uid())<>'Updated Name' then raise exception 'Profile did not update';end if;
 stats:=get_statistics((now() at time zone 'America/Sao_Paulo')::date,(now() at time zone 'America/Sao_Paulo')::date);
 if (stats->>'total')::int<>1 or (stats->>'resolvedCount')::int<>0 or stats->>'averageResolutionHours' is not null then raise exception 'Incorrect statistics: %',stats;end if;
 begin perform get_statistics('2026-11-15','2026-11-14');raise exception 'Reversed date period accepted';exception when invalid_parameter_value then null;end;
end$$;
rollback;
