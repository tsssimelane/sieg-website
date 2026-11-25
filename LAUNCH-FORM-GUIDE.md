# Existing launched website?

Use **UPDATE-START-HERE.md**. Do not replace your working configuration with a new setup form download.

# Launch setup form

1. Extract the website ZIP on your own computer and open LAUNCH-SETUP.html in your browser.
2. Install Node.js 22+ and Python 3. In the website folder run `npm ci` and `npx wrangler login`.
3. Create the fresh database and bucket using `npx wrangler d1 create sieg-production` and `npx wrangler r2 bucket create sieg-production-files`.
4. Enter your Account ID, returned database ID and Access configuration in the form. Hostname defaults to www.sieg.ltd. Complete optional service fields when available.
5. Download configuration and replace the website folder's wrangler.jsonc. Confirm the domain is in this Cloudflare account and the Access application protects it.
6. Download private secrets into the same local folder when ready. Never send launch-secrets.json through chat, email, Git or a website upload. It is excluded from Git and the public build. Downloaded secrets are unencrypted, so protect/delete the file yourself.
7. Run `npx wrangler d1 migrations apply DB --remote`, `npm run build` and `npm run check`.
8. Run `npm run deploy` to create the Worker and domain route. If secret-dependent features are not ready, they remain unavailable. Upload credentials with `npx wrangler secret bulk launch-secrets.json`, then delete the local secret file. Test sign-in, Earth Engine and delivery on the real domain.

See CLOUDFLARE-LAUNCH.md for detailed integration and acceptance checks. Payments and weekly delivery stay disabled until tested. This is a fresh database: no data migration is required. The launch form does not submit data, persist credentials in browser storage, validate remote accounts or deploy automatically. The Cloudflare API token is unnecessary for interactive Wrangler login; use a scoped token only for separately configured CI automation.
