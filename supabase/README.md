# Database operations

`supabase/config.toml` targets Supabase CLI 3 and PostgreSQL 17. Email signups produce a session immediately (`auth.email.enable_confirmations=false`), as approved. Set the deployed Auth project's equivalent setting in its dashboard; a local config does not change a hosted project.

Run `npm run test:db` for a fresh disposable PostgreSQL 17 Docker container. It uses temporary in-memory data, applies `tests/db/bootstrap.sql`, all migrations, the catalog seed, SQL behavior assertions and independent concurrent sessions, then removes its container even on failure. This command never connects to an existing or remote database. It requires Docker and Python 3. The bootstrap supplies minimal Auth and Storage table shapes; this verifies PostgreSQL authorization, policies, constraints and RPC transactions, not the behavior of the GoTrue or Storage HTTP services.

For full service integration, run `npx supabase start` on a machine with enough Docker disk space, then run `bash tests/db/run.sh` against a fresh local database. The latter defaults to the container `supabase_db_campus-em-dia`; set `CAMPUS_DB_CONTAINER` if its name differs. Full-stack startup could not be completed in this implementation environment: downloading the service images exhausted disk space. The newly downloaded images were removed. No remote project was modified.

The catalog migration creates only four configurable demonstration sectors and categories, so `supabase db push` initializes them in a hosted database too. `seed.sql` is intentionally empty. Neither creates accounts, occurrences, passwords or administrator grants.

After creating the first account normally, an operator with SQL access can grant administration:

```sql
insert into public.admin_roles(user_id)
values ('REPLACE-WITH-AUTH-USER-UUID')
on conflict do nothing;
select user_id from public.admin_roles;
```

No exposed RPC can grant this role. Administrator rights and sector membership are separate; administrators need a current sector membership to handle its occurrences. Public tables grant authenticated users SELECT only. All business mutations use restricted security-definer RPCs with an empty search path. Catalog/membership changes and occurrence actions serialize on a transaction advisory lock to keep inactive-sector and removed-membership rules consistent. This intentionally favors simple correctness over high write throughput for this academic deployment.

Photos use the private `occurrence-photos` bucket with JPEG, PNG and WebP, limited to 2 MiB. Attachment validates upload ownership, metadata and existence, and rejects uploads at least 24 hours old. Storage permits removal only while an object is unlinked; a database trigger additionally blocks deletion of an attached object. No update policy permits overwrite.
