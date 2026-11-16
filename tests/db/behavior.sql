\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000001','member@test.invalid','{"name":"Member Test","role":"admin"}'),
 ('10000000-0000-0000-0000-000000000002','staff@test.invalid','{"name":"Staff Test"}'),
 ('10000000-0000-0000-0000-000000000003','admin@test.invalid','{"name":"Admin Test"}');
do $$begin
 if (select count(*) from public.profiles) <> 3 then raise exception 'signup profiles missing'; end if;
 if exists(select 1 from public.admin_roles) then raise exception 'metadata escalated privileges'; end if;
end$$;
insert into admin_roles(user_id) values ('10000000-0000-0000-0000-000000000003');
insert into sectors(id,name) values('20000000-0000-0000-0000-000000000001','Sector Test'),('20000000-0000-0000-0000-000000000002','Other Sector');
insert into categories(id,name,sector_id,icon) values('30000000-0000-0000-0000-000000000001','Category Test','20000000-0000-0000-0000-000000000001','tool');
insert into sector_memberships(user_id,sector_id) values('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select create_occurrence('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','A broken light near the campus',-20.76,-42.86);
select create_occurrence('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','A broken light near the campus',-20.76,-42.86);
do $$declare o uuid; begin
 select id into o from occurrences limit 1;
 if (select count(*) from occurrences) <> 1 then raise exception 'request retry duplicated occurrence'; end if;
 begin perform confirm_occurrence(o); raise exception 'Author confirmed own occurrence'; exception when insufficient_privilege then null; end;
 if exists(select 1 from confirmations where occurrence_id=o) then raise exception 'Rejected author confirmation persisted'; end if;
 if (select count(*) from occurrence_events where occurrence_id=o) <> 1 then raise exception 'Rejected author confirmation added history'; end if;
 begin perform create_occurrence('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Different description here',-20.76,-42.86); raise exception 'expected request conflict'; exception when unique_violation then null; end;
 begin perform create_occurrence(gen_random_uuid(),'30000000-0000-0000-0000-000000000001','Invalid geographic bounds',0,0); raise exception 'accepted invalid bounds'; exception when check_violation then null; end;
 begin update occurrences set status='resolvida'; raise exception 'direct write permitted'; exception when insufficient_privilege then null; end;
 begin perform transition_occurrence(o,'registrada','20000000-0000-0000-0000-000000000001','analise'); raise exception 'member transitioned'; exception when insufficient_privilege then null; end;
 perform add_contribution(o,'50000000-0000-0000-0000-000000000001','Useful information');
 perform add_contribution(o,'50000000-0000-0000-0000-000000000001','Useful information');
 begin perform add_contribution(null,'50000000-0000-0000-0000-000000000001',null); raise exception 'Null payload replay accepted'; exception when unique_violation then null; end;
 if (select count(*) from contributions) <> 1 then raise exception 'contribution retry duplicated'; end if;
 if (select count(*) from occurrence_events) <> 2 then raise exception 'history missing or duplicated'; end if;
 if exists(select 1 from admin_roles) then raise exception 'admin role leaked'; end if;
 begin perform list_admin_users(); raise exception 'member read emails'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$declare o uuid; begin
 select id into o from occurrences limit 1;
 if not confirm_occurrence(o) then raise exception 'Other member confirmation missing'; end if;
 if confirm_occurrence(o) then raise exception 'Repeated confirmation inserted'; end if;
 if (select count(*) from confirmations where occurrence_id=o) <> 1 then raise exception 'Confirmation retry increased count'; end if;
 if (select count(*) from occurrence_events where occurrence_id=o and type='confirmed') <> 1 then raise exception 'Confirmation retry duplicated history'; end if;
 perform transition_occurrence(o,'registrada','20000000-0000-0000-0000-000000000001','analise');
 begin perform transition_occurrence(o,'registrada','20000000-0000-0000-0000-000000000001','analise'); raise exception 'stale update accepted'; exception when serialization_failure then null; end;
 begin perform transition_occurrence(o,'analise','20000000-0000-0000-0000-000000000001','resolvida','Fixed with new replacement'); raise exception 'invalid transition accepted'; exception when invalid_parameter_value then null; end;
 perform transition_occurrence(o,'analise','20000000-0000-0000-0000-000000000001','andamento');
 begin perform transition_occurrence(o,'andamento','20000000-0000-0000-0000-000000000001','resolvida','short'); raise exception 'short resolution accepted'; exception when invalid_parameter_value then null; end;
 perform transition_occurrence(o,'andamento','20000000-0000-0000-0000-000000000001','resolvida','Replaced the broken component');
 if (select resolved_at from occurrences where id=o) is null then raise exception 'resolution timestamp missing'; end if;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$begin
 begin perform save_sector('Sector Test','',false,'20000000-0000-0000-0000-000000000001'); raise exception 'deactivated sector with active category'; exception when unique_violation then null; end;
 if (select count(*) from list_admin_users()) <> 3 then raise exception 'admin users missing'; end if;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from occurrences; raise exception 'anonymous read accepted'; exception when insufficient_privilege then null; end;
 begin perform update_profile('Anonymous'); raise exception 'anonymous rpc permitted'; exception when insufficient_privilege then null; end;
end$$;
rollback;
