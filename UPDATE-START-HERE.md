# SIEG update · 14 November 2026

Latest layout update: map canvases snap to the vertical Mercator world-tile height, with polar panning limits to avoid empty grey strips. Detailed AOI views stay zoomed when the layout resizes. Standalone “then” and “or” labels have been removed from all AOI panels.

Latest changes: world overview on map startup/reset; renamed service addresses `/fields`, `/irrigate`, `/hydrology`, `/eco`, `/estates`, `/address`, `/learn`, `/experts`. Old service page URLs redirect permanently to the new names; queries are preserved. Menus, buttons and report return links use the new addresses. A canonical URL and sitemap are included. Geographic selection and report maps retain the analysed-area framing.

Fit-map and zoom controls now form a compact stack with a 6px gap and larger touch targets on mobile.

AOI controls now use a one-shot **Zoom to current location** icon instead of country/village inputs in Fields, Irrigate, Eco and Hydrology. Upload buttons read **Upload AOI boundary** and appear at the bottom of each AOI panel, below location and boundary-selection controls. Permission is requested only when clicked. The map can still be moved manually; upload/draw steps, nearby HydroBASINS, boundary checks, and Change area remain. Device location is not itself an analysis boundary or a payment authorization. Country context uses bundled static geography; coordinates are not sent to a place-search provider.


This update is prepared and locally tested. It has NOT been deployed to www.sieg.ltd.
Your existing Worker secrets are never copied, displayed or replaced by this update.

## Install without losing your working settings

Extract this ZIP into a NEW folder next to your current `Cloudfare` folder, for example `SIEG-Update`. Do not overwrite your working folder with the ZIP's placeholder wrangler.jsonc.

In PowerShell inside the NEW update folder:

```powershell
node .\scripts\apply-update.mjs "C:\Users\User\Downloads\Cloudfare"
```

The installer copies the updated source into your existing folder, preserves wrangler.jsonc and private local files, installs the locked dependencies, backs up and upgrades the configuration, and builds. It does not publish anything. Python is detected automatically.

Then:

```powershell
cd "C:\Users\User\Downloads\Cloudfare"
npm.cmd run check
```

Your domain, Account ID, production database and storage, AUD, project and prices remain as configured. Existing Cloudflare runtime secrets stay in Cloudflare. Nothing is printed from them. If a prior `wrangler.before-update.jsonc` exists, keep/rename it before rerunning the installer.

## Publish the reliability update

Keep the current whole-site Access protection while deploying and testing this update:

```powershell
npm.cmd run release:production
```

This validates settings, builds and tests, then deploys. It does not run production database migrations or enable payments. The existing database schema remains compatible.

After deployment, sign in at www.sieg.ltd and open `/admin/launch`. The new panel verifies database/storage access and reports whether other services are configured. Click **Check analysis connection** to verify Google authorization and read access to Villages_New. This does not run a field analysis or send an email.

Configured ≠ verified: email delivery, payment verification, satellite reports and scientific results still need real acceptance tests with the actual provider credentials.

## Public homepage with customer sign-in

Do this only after the reliability update is live and its /login route works under current Access protection.

1. In Cloudflare Access edit your existing SIEG application's destination, changing the protected path from the entire hostname to **www.sieg.ltd/login**. Keep the same application (and AUD). Do not delete or recreate it. No general Bypass policy is needed. Remove the old whole-host destination only once the /login destination has been saved.
2. Keep Allow TSS for the initial administrator check. Open the homepage in a separate incognito browser: the marketing pages should load without login. Use Sign in to confirm the email-code flow and then administrator checks.
3. For customers, add a deliberate customer sign-in policy and login method in Access. Keep a small customer/tester email allowlist first. Resources and launch checks remain restricted by the application to the administrator email. Review Cloudflare Access's user limits and your chosen customer identity approach before broad public signups.
4. The backend verifies the signed Access header/cookie on every identity-dependent request. Signed-out visitors cannot gain access by supplying identity headers. An expired cookie does not blank the public homepage. Administrator authorization remains separate from customer authentication.
5. `/api/reports/paygate/notify` must be reachable by PayGate when payments are enabled. With only /login protected by Access, it is not blocked by the Access login wall; the existing application still verifies provider checksums and payment state.
6. Keep www.sieg.ltd as the canonical hostname. Configure a separate Cloudflare redirect from sieg.ltd to https://www.sieg.ltd preserving path/query; do not use an Access login app for the bare-domain redirect.

This is an Access-based sign-in release, not a separately hosted password identity service. Provider secrets, billing activation and Access destination/policy changes still require your Cloudflare account.

## Staging first for future changes

The upgraded configuration adds an explicit staging environment with separate placeholder DB and Access IDs and separate bucket. No production domain routes are assigned to staging. Create these once:

```powershell
npx.cmd wrangler d1 create sieg-staging
npx.cmd wrangler r2 bucket create sieg-staging-files
```

In wrangler.jsonc update only `env.staging`: paste the staging database ID and staging Access application AUD, and use your team domain. Protect the staging workers.dev hostname using its own Access application. Set secrets per environment, such as `npx.cmd wrangler secret put GEE_SERVICE_ACCOUNT_JSON --env staging`. Do not reuse payment/email/SMS credentials: this update suppresses their delivery in staging even if accidentally supplied.

Apply the NEW staging schema and release:

```powershell
npx.cmd wrangler d1 migrations apply DB --env staging --remote
npm.cmd run release:staging
```

The release helper rejects shared production/staging database IDs or bucket names and rejects production routes on staging. Staging outputs and records remain separate. Accept field analysis, report composition, mobile forms and user ownership there before releasing production.

## Git repository and release automation

Keep this source in a private Git repository. `.github/workflows/cloudflare.yml` runs build and tests on pull requests/main pushes. Production deployment is manual from the Actions page on main. Staging deployment on main pushes is opt-in through repository variable SIEG_STAGING_ENABLED=true.

Create separate GitHub environments named `staging` and `production`. Configure production required reviewers if your GitHub plan supports them. Each environment needs these variables: CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_R2_BUCKET_NAME, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD. Set a scoped CLOUDFLARE_API_TOKEN as an environment secret. The token needs deployment access for the selected account; provider keys stay in the Worker runtime, not in Git or workflow variables. Use distinct database/bucket metadata for each environment. The workflow does not automatically migrate the production schema.

No private repository or CI connection has been created by this update. A connected account/repository is needed to turn the supplied workflow on.

## Verified locally

Build, Worker syntax, signed-token validation, incorrect issuer/audience/expiry/signature rejection, anonymous header stripping, administrator restrictions, redirect safety, homepage route, private configuration preservation, staging email/payment suppression. Provider credentials and live external deliveries were not available for end-to-end verification.

Official guidance:
- https://developers.cloudflare.com/workers/wrangler/environments/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
