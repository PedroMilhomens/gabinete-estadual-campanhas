# Operations, backups, and incident response

## Static security headers

The `public/_headers` file uses the header-file format supported by Netlify and
Cloudflare Pages. Configure equivalent response headers if deploying to another
static host. The Content Security Policy allows the Supabase project origin and
Cloudflare Turnstile; replace the Supabase wildcard with the exact project
origin when configuring headers directly at the host. Verify headers on the
deployed HTTPS site after every hosting configuration change.

## Database backups

Install the PostgreSQL client tools (`pg_dump`), then run the backup from a
trusted machine with the read-only, TLS-enabled database connection URL supplied
through its environment. Do not put the URL in command arguments, source
control, job definitions, or logs:

```sh
python3 scripts/backup-supabase.py
```

The script writes a custom-format dump to `~/backups/demolay-ro` by default, or
to a directory selected with `--output-dir`. It refuses destinations inside the
repository, restricts the backup directory to the current user, creates files
with mode `0600`, and requires TLS. Arrange a daily run on a trusted machine
using an OS secret manager or another protected environment-injection method.
Keep backups outside Supabase, restrict access, encrypt the backup volume, and
apply a retention period approved by the data controller. The script does not
delete old backups.

PostgreSQL dumps do not include the binary contents of Supabase Storage. Back
up the private `attachments` bucket separately using an approved storage export
process before treating recovery as complete. Do not make the bucket public to
facilitate backups.

## Restore procedure

1. Notify the project administrators and pause writes while restoring.
2. Provision an isolated recovery project/database and confirm its PostgreSQL
   version and required Supabase extensions are compatible with the dump.
3. Configure `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGSSLMODE=require`,
   and credentials through the trusted machine's protected secret mechanism or
   a `0600` PostgreSQL password file.
4. Inspect the dump before restoring:

   ```sh
   pg_restore --list "$BACKUP_FILE"
   ```

5. Restore into the isolated, empty recovery database. Do not use `--clean` or
   point the restore command at the live project:

   ```sh
   pg_restore --no-owner --no-acl --dbname="$PGDATABASE" "$BACKUP_FILE"
   ```

6. Restore the separately backed-up private storage objects, verify database
   migrations, RLS, authentication, and signed attachment access, then have an
   administrator validate the recovered application before redirecting users.
7. Record the recovery outcome and securely retire temporary recovery data.

Run a recovery exercise periodically; an untested dump is not a verified
backup.

## Administrator safeguards and retention

Keep the number of administrators at three or fewer. Require multi-factor
authentication for administrator accounts on GitHub, Supabase, and the email
provider. The application does not currently automate the campaign-based data
retention schedule; establish and document an approved retention period before
production, then process expiry requests through a reviewed administrative
workflow.

## Audit log

Profile role/status changes and submission score/status changes are recorded
by database triggers. API roles cannot directly insert or delete audit entries;
approved administrators can read them. The service role retains update access
only for server-side user-data anonymization. Do not add a client policy that
allows direct writes to `audit_log`.

## Security incident response

1. Restrict access to affected accounts and notify the responsible project
   administrators. Preserve relevant timestamps and audit records; do not put
   personal data or credentials in issue trackers or public logs.
2. Rotate the affected Supabase keys, SMTP/email-provider credentials,
   Turnstile secret, and database-webhook secret through their provider
   dashboards. Update Edge Function secrets and webhook headers, then redeploy
   affected functions.
3. Revoke affected Supabase sessions, remove unauthorized access, and review
   the audit log, webhook history, and provider logs for the exposure scope.
4. Notify affected people and the Order through the responsible privacy
   contact, following applicable LGPD obligations and the incident response
   decisions of the data controller.
5. Restore from a known-good backup only after validating the recovery project.
   Document remediation and verify security headers, RLS, and role access before
   reopening the service.
