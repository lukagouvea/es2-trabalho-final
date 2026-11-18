"""Real independent DB sessions: retry uniqueness, stale transition and atomic history."""
import concurrent.futures
import subprocess
import sys
import uuid
container = sys.argv[1]

def sql(query, check=True):
    result = subprocess.run(['docker','exec','-i',container,'psql','-U','postgres','-At','-v','ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result

user, sector, category, request = [str(uuid.uuid4()) for _ in range(4)]
occurrence = None
try:
    sql(f"""insert into auth.users(id,email,raw_user_meta_data) values('{user}','concurrency-{user}@test.invalid','{{"name":"Concurrent Test"}}');
    insert into sectors(id,name) values('{sector}','Concurrent {sector}');
    insert into categories(id,name,sector_id,icon) values('{category}','Concurrent {category}','{sector}','tool');
    insert into sector_memberships(user_id,sector_id) values('{user}','{sector}');""")
    prefix = f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{user}',true);"
    create = prefix + f"select (create_occurrence('{request}','{category}','Concurrent demand request',-20.76,-42.86)).id;commit;"
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(lambda _: sql(create),range(8)))
    assert sql(f"select count(*) from occurrences where author_id='{user}';").stdout.strip() == '1'
    occurrence = sql(f"select id from occurrences where author_id='{user}';").stdout.strip()
    transition = prefix + f"select transition_occurrence('{occurrence}','registrada','{sector}','analise');commit;"
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: sql(transition,False),range(2)))
    assert sorted(r.returncode == 0 for r in results) == [False,True], [r.stderr for r in results]
    assert any('Occurrence has changed' in r.stderr for r in results)
    assert sql(f"select count(*) from occurrence_events where occurrence_id='{occurrence}';").stdout.strip() == '2'
    # Catalog deactivation and creation must never leave an open demand in an inactive sector.
    for iteration in range(4):
        race_sector, race_category = str(uuid.uuid4()), str(uuid.uuid4())
        sql(f"insert into sectors(id,name) values('{race_sector}','Race {race_sector}');insert into categories(id,name,sector_id,icon) values('{race_category}','Race {race_category}','{race_sector}','tool');insert into admin_roles(user_id) values('{user}') on conflict do nothing;")
        create_race=prefix+f"select create_occurrence(gen_random_uuid(),'{race_category}','Demand racing catalog deactivation',-20.76,-42.86);commit;"
        deactivate=prefix+f"select save_category('Race {race_category}','{race_sector}','tool',false,'{race_category}');select save_sector('Race {race_sector}','',false,'{race_sector}');commit;"
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            results=list(executor.map(lambda q: sql(q,False),[create_race,deactivate]))
        assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
        assert sql(f"select count(*) from occurrences o join sectors s on s.id=o.sector_id where not s.active and o.sector_id='{race_sector}';").stdout.strip()=='0'
        sql(f"delete from occurrence_events where occurrence_id in(select id from occurrences where sector_id='{race_sector}');delete from occurrences where sector_id='{race_sector}';delete from categories where id='{race_category}';delete from sectors where id='{race_sector}';")
    # Distinct fields edited by independent admin sessions must both survive.
    rename = prefix + f"select patch_sector('{sector}', p_name => 'Renamed {sector}');commit;"
    describe = prefix + f"select patch_sector('{sector}', p_description => 'Updated details');commit;"
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(sql, [rename, describe]))
    assert sql(f"select name,description from sectors where id='{sector}';").stdout.strip() == f"Renamed {sector}|Updated details"
    # Storage DELETE and attachment contend for the same object row.
    for iteration in range(4):
        path=f"{user}/{uuid.uuid4()}.png"
        sql(f"insert into storage.objects(bucket_id,name,metadata) values('occurrence-photos','{path}','{{\"size\":100,\"mimetype\":\"image/png\"}}');")
        attach=prefix+f"select create_occurrence(gen_random_uuid(),'{category}','Photo racing deletion',-20.76,-42.86,p_photo_path=>'{path}');commit;"
        delete=prefix+f"delete from storage.objects where bucket_id='occurrence-photos' and name='{path}';commit;"
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            results=list(executor.map(lambda q: sql(q,False),[attach,delete]))
        assert any(r.returncode==0 for r in results)
        assert sql(f"select count(*) from occurrences o where photo_path='{path}' and not exists(select 1 from storage.objects s where s.name=o.photo_path and s.bucket_id='occurrence-photos');").stdout.strip()=='0'
    # Existing original occurrence has exactly the two events asserted above.
    # A real event insert failure must roll back its state transition.
    sql("create function private.test_reject_event() returns trigger language plpgsql as $$begin raise exception 'test event failure';end$$;create trigger test_reject_event before insert on occurrence_events for each row execute function private.test_reject_event();")
    result=sql(prefix+f"select transition_occurrence('{occurrence}','analise','{sector}','andamento');commit;",False)
    assert result.returncode and 'test event failure' in result.stderr
    assert sql(f"select status from occurrences where id='{occurrence}';").stdout.strip() == 'analise'
    print('PASS: concurrent retries; stale transitions; catalog deactivation races; photo attach/delete races; atomic history rollback')
finally:
    sql('drop trigger if exists test_reject_event on occurrence_events;drop function if exists private.test_reject_event();',False)
    sql(f"delete from occurrence_events where actor_id='{user}';delete from occurrences where author_id='{user}';delete from categories where id='{category}';delete from sector_memberships where user_id='{user}';delete from sectors where id='{sector}';delete from storage.objects where name like '{user}/%';delete from auth.users where id='{user}';",False)
