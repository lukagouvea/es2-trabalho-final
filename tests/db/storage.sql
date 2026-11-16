\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,raw_user_meta_data) values('11000000-0000-0000-0000-000000000001','photo@test.invalid','{"name":"Photo Test"}');
insert into sectors(id,name) values('21000000-0000-0000-0000-000000000001','Photo Sector');
insert into categories(id,name,sector_id,icon) values('31000000-0000-0000-0000-000000000001','Photo Category','21000000-0000-0000-0000-000000000001','tool');
insert into storage.objects(bucket_id,name,metadata,created_at) values
('occurrence-photos','11000000-0000-0000-0000-000000000001/valid.png','{"size":100,"mimetype":"image/png"}',now()),
('occurrence-photos','11000000-0000-0000-0000-000000000001/old.png','{"size":100,"mimetype":"image/png"}',now()-interval '25 hours'),
('occurrence-photos','11000000-0000-0000-0000-000000000001/large.png','{"size":2097153,"mimetype":"image/png"}',now()),
('occurrence-photos','11000000-0000-0000-0000-000000000001/invalid.svg','{"size":100,"mimetype":"image/svg+xml"}',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000001',true);
do $$declare path text;begin
 foreach path in array array['missing.png','old.png','large.png','invalid.svg'] loop
  begin perform create_occurrence(gen_random_uuid(),'31000000-0000-0000-0000-000000000001','A photo of a broken component',-20.76,-42.86,p_photo_path=>'11000000-0000-0000-0000-000000000001/'||path);raise exception 'Invalid photo accepted: %',path;exception when invalid_parameter_value then null;end;
 end loop;
 begin perform create_occurrence(gen_random_uuid(),'31000000-0000-0000-0000-000000000001','Photo from another user',-20.76,-42.86,p_photo_path=>'another-user/file.png');raise exception 'Foreign path accepted';exception when insufficient_privilege then null;end;
 perform create_occurrence(gen_random_uuid(),'31000000-0000-0000-0000-000000000001','A valid photo attached',-20.76,-42.86,p_photo_path=>'11000000-0000-0000-0000-000000000001/valid.png');
 begin perform create_occurrence(gen_random_uuid(),'31000000-0000-0000-0000-000000000001','Another duplicate photo',-20.76,-42.86,p_photo_path=>'11000000-0000-0000-0000-000000000001/valid.png');raise exception 'Photo reused';exception when unique_violation then null;end;
 delete from storage.objects where name='11000000-0000-0000-0000-000000000001/valid.png';
 if not exists(select 1 from storage.objects where name='11000000-0000-0000-0000-000000000001/valid.png') then raise exception 'Attached photo deleted';end if;
 delete from storage.objects where name='11000000-0000-0000-0000-000000000001/old.png';
 if exists(select 1 from storage.objects where name='11000000-0000-0000-0000-000000000001/old.png') then raise exception 'Unlinked upload not deletable';end if;
 begin insert into storage.objects(bucket_id,name) values('occurrence-photos','other-user/illegal.png');raise exception 'Foreign directory upload permitted';exception when insufficient_privilege then null;end;
end$$;
rollback;
