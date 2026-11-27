# SIEG release-check corrective patch — 27 November 2026
Applies to SIEG_Cloudflare_Git_Update_2026-11-27.zip.
Copy the ZIP contents over your existing SIEG-Production clone. This patch changes 11 test files and the Fields report evaluator callback error handling. No production settings, database schema, payment controls or deployment gate are changed.
Current AOI policy tested: Fields and Irrigate 50 ha; Eco and Hydrology 500 ha; free preview 5 ha. Draw completion validates geometry separately from analysis area limits. The report tests now exercise completed selected indicators, current PDF template, report-reference creation and error handling. Map mocks model the current camera and panel behaviour.
Targeted suites: 57/57 passed. Full dependency-independent run: 205 passed, 6 modules unable to load missing dependencies jose/jsonc-parser in the isolated runner. Run npm ci on your Windows machine, then npm run build and npm run check. Do not push or deploy if any failures remain.
