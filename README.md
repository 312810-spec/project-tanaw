# Project TANAW

TANAW supports school SMEA evidence preparation, independent review, packet Lock,
and district return. Use synthetic records in development and CI. Production
workbook import, governed results, and district acceptance require their own
activation evidence. See [the release task ledger](docs/remaining-tasks.md).

## Local development

Use Node 22 and Python 3.13 to match CI. An isolated Supabase stack needs Docker.
Install locked dependencies with `npm ci`. The public app can start without
Supabase and shows its configuration-unavailable state.

For authenticated local development, start the local stack with
`npx --no-install supabase start`. Set the public URL, publishable key, and
canonical application origin as documented in [.env.example](.env.example).
Keep privileged credentials out of browser configuration and the repository.
Run `npm run dev` and open [the app](http://localhost:3000).

## Release verification

- Run `npm run verify`, `npm run lint`, `npm run build`, and
  `npm audit --audit-level=high` against the candidate lockfile.
- Run the domain, public browser and isolated Supabase workflows for the
  candidate SHA. The isolated workflow applies migrations and exercises role
  boundaries, recovery, and the synthetic reporting journey.
- Apply the candidate migrations in order on the authorized target database
  before serving the updated app. Verify the migration receipt and candidate SHA.
- Check `GET /api/supabase-health`. HTTP 200 with `{"ready":true}` verifies the
  configured database release contract and, if enabled, the packaged Python
  preview worker and registry. HTTP 503 means this release readiness check
  did not pass. Verify Auth, mail delivery, and the browser workflow separately.
- Keep account provisioning in its isolated local mode. Enable the file-check
  capability only after confirming the target host supports its Python worker.

### Staging acceptance and rollback

Use a dedicated staging database with synthetic records. Record the candidate
commit SHA, migration versions and CI run links before testing. Confirm the
previous application version and take a staging database backup. Restore that
backup into a separate disposable database and verify its migration history,
packet versions, and school access before declaring recovery ready.

| Check | Required staging evidence |
| --- | --- |
| Access and workflow | Teacher submission, subject review, coordinator review, independent Head review, Lock and district return all reference the same scoped evidence and packet versions. Unauthorized school and district requests cannot retrieve private evidence. |
| Recovery | An interrupted or stale write requires reconciliation. A received recovery email leads to the approved callback, replaces the password and preserves account access rules. |
| Deployment | The deployed SHA matches CI, readiness returns 200, and school role checks pass against the deployed instance. Record the environment and test date without credentials. |
| Rollback | Record the prior build, restore evidence, and who can switch traffic. If a smoke check fails, pause rollout and verify the previous build against the current schema before switching. Use an approved forward fix or restore plan when compatibility is uncertain. |

Keep pilot access pending until the designated owner reviews the staging receipt
and records the pilot scope, participants and release decision in the task ledger.

### Windows prerender workaround

If a local Windows build fails with `EPERM: mkdir` under `.next/server/app`,
repeat it with the opt-in directory retry preload. It retries that operation
briefly and surfaces persistent errors. Linux CI uses the standard build.

```powershell
$previousNodeOptions = $env:NODE_OPTIONS
$hook = (Resolve-Path scripts/retry-windows-build-mkdir.cjs).Path.Replace('\', '/')
try {
  $env:NODE_OPTIONS = ('--require "' + $hook + '" ' + $previousNodeOptions).Trim()
  npm run build
} finally {
  $env:NODE_OPTIONS = $previousNodeOptions
}
```

### Authenticated browser test through published ports

On a dedicated synthetic stack with the candidate migrations applied, the
browser runner can read CLI status on standard input and seed fixtures through
native `psql`. This lets the runner use the local API and SQL ports without
calling Docker. The shell running `supabase status` still needs Docker access.
Keep the status in the pipe and out of files and terminal logs.

```powershell
# Set TANAW_PLAYWRIGHT_MODULE to the installed Playwright module if needed.
# Apply the Windows build workaround above in this shell if needed.
node node_modules/supabase/dist/supabase.js status --output json |
  node --experimental-strip-types scripts/verify_authenticated_browser.mjs --status-stdin
```

Put `psql` on PATH or set `TANAW_BROWSER_PSQL` to its executable path. The
runner requires the TANAW loopback API and database ports and creates synthetic
users and records in that stack.
