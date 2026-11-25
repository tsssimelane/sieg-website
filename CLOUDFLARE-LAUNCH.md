# Latest update

Start with **UPDATE-START-HERE.md** for an existing launched website. It supersedes the original setup below.

# SIEG Cloudflare launch

Prepared from published source 8358a08c0f080e5f790385692dc9d9fa1a18a565 (13 November 2026).
This is a separate launch copy. The existing hosted website is unchanged.
Deploy using Cloudflare Workers + Static Assets + D1 + R2, not a static Pages upload.
Start here rather than the historical README, which describes the former host.

## 1. Install and create resources

Install Node.js 22+ and Python 3. Run these commands in this folder (Windows users may need `python` instead of `python3` in package.json):

```sh
npm ci
npx wrangler login
npx wrangler d1 create sieg-production
npx wrangler r2 bucket create sieg-production-files
```

Copy the returned D1 database ID into `wrangler.jsonc`. Choose unique resource names if necessary and update the configuration. The config includes only placeholders, no credentials.

For a NEW empty database:

```sh
npx wrangler d1 migrations apply DB --remote
```

The Cloudflare migrations intentionally omit historical migration 0003, which deletes address cards. Do not apply the historical drizzle folder to a migrated production database.

## 2. Configure sign-in before enabling users

Create a Cloudflare Zero Trust Access self-hosted application on your chosen domain. Configure email one-time PIN or your identity provider and explicit allowed-user policies. Put its team domain and application AUD into `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`. Protect the whole site for the first private launch. After authentication, Access redirects users back to the requested page.

The included adapter validates signed Access JWTs, issuer and audience and strips all client-supplied former-host identity headers. Only verified users gain account/API access. Admin email remains tss.simelane@gmail.com. A missing token remains anonymous; invalid tokens fail closed. Test an ordinary account and admin account separately.

Former ChatGPT login links/session UI are not an independent public registration system. For a public customer launch, replace those entry links with your Access-protected application URL, or implement a customer identity provider and adapt verified identity. This package prepares an Access-based private launch; it does not claim a finished public signup migration.

## 3. Add service secrets

```sh
npx wrangler secret put GEE_SERVICE_ACCOUNT_JSON
npx wrangler secret put PAYGATE_ID
npx wrangler secret put PAYGATE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put REPORT_FROM_EMAIL
```

For Earth Engine paste the complete service-account JSON into the interactive secret prompt; project `ee-gee023` must permit that account and its datasets. For email use a verified sender. Optional features need `OPENAI_API_KEY` (Learn AI), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (Address SMS). Do not put secret files in public/ or commit them.

Checkout is disabled initially. Keep REPORT_CHECKOUT_ENABLED=false until a real payment return, notification and verified report delivery have passed. Set it to true only afterwards. PayGate notification endpoint is `/api/reports/paygate/notify`; return page `/report-payment.html`. An Access-protected site must allow the exact provider webhook path through Access while retaining the application's payment verification. Do not bypass all `/api/*` routes. Confirm production domain/callback settings with PayGate.

## 4. Build, verify and deploy

```sh
npm run build
npm run check
npm run dry-run
npm run deploy
```

Wrangler also runs the build before deployment. Images and browser files are uploaded as native static assets; server-side JSON lookups remain embedded. No runtime customer records or secrets are in this package.

Add the custom domain in Cloudflare Workers Settings > Domains & Routes, complete DNS, enable Access for that hostname, then verify HTTPS and redirects. Before a public release, remove/restrict alternate workers.dev access consistently with the intended audience.

## 5. Data migration and final acceptance

An empty D1/R2 pair starts a NEW website database. Existing users, properties, payments, reports, uploaded datasets and files are NOT transferred by a source ZIP. Export/import D1 and copy R2 objects through the current host's authorized facilities before cutover. Keep a backup and the original site available until verified. Access uses `cf:<subject>` owner IDs, which differ from ChatGPT IDs: explicitly map old owners to new verified accounts before restoring access to their records. Do not update payment ownership blindly.

Verify on the new hostname:
- Homepage/service menus and mobile forms; maps and satellite layers.
- Anonymous requests cannot obtain admin privileges via forged oai-* headers.
- Ordinary users cannot access another user's records; admin upload works.
- Free-preview limits persist; paid report items and navigation QR work.
- Earth Engine small-area analysis with actual service credentials.
- Test payment, server notification, email delivery and retry access.
- Property ID counters, photos and optional/mandatory boundaries.

Weekly automation's former `/mcp` integration is deliberately disabled in the standalone entry. There is no cron configured. Keep WEEKLY_CROP_ENABLED=false until its scheduler/integration is explicitly migrated and tested.

No Cloudflare account resources, domain, secrets, live payments or production data have been configured by this preparation. Local builds/tests and a Wrangler dry-run do not verify these external services.

Official references:
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/d1/wrangler-commands/
