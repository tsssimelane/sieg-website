# SIEG Cloudflare launch · Website v787

This package contains source commit 9327cf9, the Cloudflare Worker build scripts, the locked npm dependencies manifest, static assets, and D1 migrations. Production deployment has not been performed.

## Update an existing Cloudflare installation

Extract into a new folder beside your working Cloudflare folder. Use PowerShell from the extracted folder. Replace the example path with your existing folder.

```powershell
node .\scripts\apply-update.mjs "C:\Users\User\Downloads\Cloudfare"
```

The installer preserves the working Wrangler configuration and local secret files, installs dependencies, and builds the update. A new installation should follow CLOUDFLARE-LAUNCH.md and replace the template's D1 and Access values with those from the Cloudflare dashboard. Use existing production bindings where applicable. Store credentials through Cloudflare secrets.

## Preflight

1. Verify the Worker name and existing routes, D1 binding DB, R2 binding BUCKET, and the Cloudflare Access team domain and application AUD. The template leaves account-specific IDs as placeholders and assigns no production domain routes.
2. Check remote D1 migration history before applying any migrations. Use separate bindings for staging. The three included migrations ran successfully in a clean local SQLite database.
3. Run `npm.cmd run check`. The release script blocks deployment when this check fails. Resolve the failures or verify against the intended behavior before releasing.
4. Run `npm.cmd run dry-run` with your configured Wrangler file. For staging, use `npm.cmd run release:staging` once the staging settings and tests pass.
5. Smoke-test sign-in, administrator access, a small analysis and report, and key forms on a phone. The site template keeps report checkout and weekly crop delivery disabled. Verify actual integrations before enabling them.
6. After staging acceptance, use `npm.cmd run release:production` in the configured folder. See CLOUDFLARE-LAUNCH.md for custom domain, provider, and Access setup.

## Local verification for this package

- Cloudflare native-assets build and Worker syntax check passed.
- D1 migrations 0000 through 0002 ran in order on a fresh local SQLite database.
- The Cloudflare suite passed 141 of 170 tests. Six test files could not load missing dependencies, and 23 other checks failed, including area-limit, report and map workspace assertions. The offline dependency cache was incomplete, so Wrangler dry-run remains pending.
- Cloudflare account settings, remote storage, provider credentials, and mobile browser rendering remain to be verified in staging.

Cloudflare Worker versions can roll back code and asset deployments. D1 and R2 data have separate lifecycles. See https://developers.cloudflare.com/workers/versions-and-deployments/.
