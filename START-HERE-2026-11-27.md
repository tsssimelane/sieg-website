# SIEG Cloudflare Git update — 27 November 2026

Source: private website revision b8ed1b7d1df55b1fd73cf7a6e0884be526152562.

## Release status
The Cloudflare asset build completed (355 assets) and Worker JavaScript syntax passed. The full regression gate is NOT green: 181 passed, 30 failed out of 211 discovered tests in this environment. Six test modules could not load dependencies (jose/jsonc-parser); npm ci offline failed because dependencies were not cached. Other failures include assertions for AOI limits, map/workspace behaviour, report caches and indicator catalogs. Do not disable these tests or bypass the release gate. See RELEASE-CHECKS.txt for names. The new supplier/field-personnel shared-access upgrade is not included because it was not implemented on the private site.

## Update the existing Git repository (Windows PowerShell)
1. Open your existing clone (previously SIEG-Recovered). Check that it is the intended repository:
   `Set-Location "$HOME\Downloads\SIEG-Recovered"`
   `git status`
   `git remote -v`
2. If the tree is clean, pull main: `git pull --ff-only origin main`.
3. Back up your existing production wrangler.jsonc outside the checkout. Keep any .dev.vars and .env files private. Do not replace your production wrangler.jsonc with the example.
4. Extract this ZIP into a NEW temporary folder and copy its contents into the existing clone (do not copy or initialise .git). Review git status and diff. The ZIP intentionally excludes live wrangler.jsonc, .git, .openai/hosting.json, dependencies, generated build output and Python cache files. The included wrangler.example.jsonc is a placeholder configuration reference only.
5. Run `npm.cmd ci`, then `npm.cmd run build` and `npm.cmd run check`. Resolve any failing checks before pushing or deploying. Retain existing Cloudflare database, R2 bucket, domain, Access audience and Worker secrets.
6. After checks pass, review the changes, then run:
   `git add -A`
   `git diff --cached --stat`
   `git diff --cached --name-only`
   Check that no secrets or environment files are staged. Commit and push:
   `git commit -m "Update SIEG website November 27 2026"`
   `git push origin main`
7. GitHub Actions runs tests on main. Production publication uses the existing workflow's manual production target, or `npm.cmd run release:production` locally after verification. Do not create a new Worker or change DNS. Deploy only after the gate passes.

## Important
This archive is a source snapshot, not an automatic deployment. Existing Git history, production credentials, D1/R2 data and domain configuration must remain intact. The private site continues to be hosted separately.
