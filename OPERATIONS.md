# Hosted accounts, submissions and launch status

## Implemented in this update

- Eco's rounded sidebar scrolls independently with a visible vertical scrollbar.
- Finishing an Eco polygon preserves vertices and completes the drawing state.
- Eco reports include completed indicator evaluations for the current AOI/session;
  changing AOI or clearing results removes that history. Unanalysed indicators
  are not silently invented or added to a purchased report.
- Property records use signed-in Sites identity and D1 storage. Up to five resized
  JPEG photographs are stored in R2. Client records enter `pending_review` and
  become public only after admin approval. Approval does not verify legal title.
- Expert profiles, profile pictures, project briefs and homepage enquiries are
  submitted to durable storage. Expert profiles need approval before publication.
  A brief is an enquiry, not a booking or a hiring agreement. Sample data remains
  clearly labelled while real records are unavailable.
- Resources includes private review queues, a configuration/dataset checklist,
  and deletion controls. Public profile/listing responses omit private contact
  emails and account identifiers. Pending photo access is owner/admin only.
- Address supports surname-only homesteads (optional given names). Other-country
  homestead uploads stay in browser memory, clear on export submission/page exit
  and expire after 30 minutes. Eswatini's admin dataset is retained separately.
- Completed report orders can be explicitly deleted by staff. Incomplete or
  unpaid orders cannot be deleted through that completed-record control.
- Dataset administration sign-in now uses the correct `return_to` parameter.
- Privacy summaries reflect actual server-side storage and review behaviour.

## Storage and deployment

The hosting manifest preserves the existing BUCKET R2 binding and adds DB D1.
`drizzle/0000_siege_operations.sql` creates `siege_records` and its two indexes.
Deployment includes SQL migration files under `dist/drizzle`. There are no schema
mutations in request handlers. Photo bytes are never embedded in D1 JSON.

Sites supplies trusted visitor identity. The website does not collect a separate
property password. The existing SIEG administrator is identified server-side;
choosing the Admin button cannot grant that role. Dataset uploads still require
their separate existing upload password. Private hosting remains unchanged.

Server listing/queue pagination uses 50 records per page and returns a cursor.
Admin queues and the public property/expert directories expose Load more. A suitable next scale-up task is geographic indexing and
spatial listing queries rather than loading an entire country into browser memory.

## Work that still needs external setup or review

1. Supply and authorize the Earth Engine service account for ee-gee023 and assets.
2. Connect verified transactional email and a supported USD Visa merchant account.
3. Resolve gateway callback access before enabling paid unattended delivery on
   the currently owner-private Site. Do not expose the Site without owner choice.
4. Upload approved homestead, village and cadastral datasets; review real property
   records and expert applications. Do not describe demo records as real listings.
5. Confirm intended public audience, custom-domain ownership/DNS and actual
   company social links, testimonials and commercial policies.
6. Run live end-to-end analysis, email, payment, browser/mobile, printed-report
   and scientific acceptance tests. Automated logic tests do not substitute for
   these. Review hydrology proxies, crop recommendations and weather periods.
7. Agree an operational data-retention period and implement scheduled enforcement;
   staff deletion controls are present but not a background retention schedule.
8. A true language-model property query assistant still needs its provider/key;
   the current natural-language interface interprets structured search filters.

## Checks

`node scripts/test_operations.cjs` applies the actual SQL to an in-memory SQLite
database and exercises account roles, owner scoping, profile/listing moderation,
protected photos, deletion, validation and private-field redaction. It also tests
Eco polygon completion and surname-only geocoding. Existing report, basemap,
shared-analysis, hydrology and geocoding tests remain applicable.

No real applications, listings, payments, emails or fabricated testimonials are
created by these tests.

## AOI sessions — 17 October 2026 (current policy)

One signed-in account receives one initial free session shared across Fields, Eco and Hydrology. Each session locks one AOI for 30 minutes, with at most 120 distinct processing requests. Fields: up to 10 km² / 1,000 ha. Eco: up to 100 km² / 10,000 ha. Hydrology: one complete hydrobasin; above 100 km² requires staff review. Large Eco administrative areas also require review. Review never bypasses the account allowance.

Session credits are durable D1 records. The initial credit has one deterministic account-scoped identity and is never replenished by refresh, logout or another service. An atomic D1 batch spends one credit and starts the job; concurrent tabs cannot use the same credit twice or extend an existing window. The 30-minute allowance permits component maps, charts and statistics for that AOI, rather than only one provider RPC. Identical computation requests are cached and in-flight duplicates are reserved in R2. Cached responses and saved summaries remain readable without rerunning analysis. Live map tiles and new computation stop after expiry.

Generate the report during the active session; checkout can complete later. A generated/stored report plus verified Visa payment grants one additional session. For cash collection, only staff marking the printed report collected and cash paid grants a session. Report creation, pending payment, failed payment, a ready-for-collection notice or a browser redirect never grants a session. Each analysis can generate at most one additional credit, even when duplicate callbacks or multiple paid copies of its report occur. No credit is granted by Estate or Address purchases. Experts has no AOI session workflow.

Previous prepaid analysis records remain readable and retain their recorded entitlement. New jobs use policyVersion 2; new analysis checkout is disabled, and report checkout is the payment path. Report fees remain in USD. User-facing analysis allowances are free to start; they are not a promise of zero provider cost to SIEG.

Before launch, configure project ee-gee023 for appropriate commercial Earth Engine access, provider billing, a daily EECU quota and budget alerts. Website controls reduce waste but are not a hard dollar cap. Provider plan selection and quotas require Google Cloud Console access. Google, Visa and email credentials must stay in hosted secrets. Verify actual AOI results, payment queries/callbacks and email delivery in production before enabling paid client use. Preserve the site audience; the gateway callback must have an approved reachable delivery path.

Tests: node scripts/test_free_sessions.cjs; node scripts/test_usage.cjs; node scripts/test_report_delivery.cjs; node scripts/test_operations.cjs; node scripts/test_shared_analysis.cjs. Browser QA is unavailable when the supported browser-control skill is absent.

## Client testimonials
The homepage Share your experience form requires Sites sign-in and publication consent. Submissions use D1 siege_records kind testimonials; optional resized JPEG photos use protected R2 storage. Open Resources → Website setup & review → Testimonials to approve, reject/unpublish or delete. Only approved records and their photos are public; email and owner identity are never returned by the public testimonial API. No automatic email notification is sent.

## Estate client registration
Clients use secure Sites/ChatGPT sign-in, then register their full name, international cellphone and account terms consent. Email is bound to the server-provided identity and cannot be supplied by the client. Profiles persist in D1 (estate_accounts). Client login opens property entry; admin login is restricted to the existing owner email and links to Resources for listing review. No separate password database or external OAuth provider is introduced.

Estate Admin login now always asks for the shared SIEG admin password on Sites, in addition to the staff identity allowlist. If no shared password exists, only the authorised staff account can set and confirm it. Uses the existing PBKDF2 password service and attempt limit. Independent hosting already requires email/password staff login.

## Service control audit — 21 October 2026
Fields and Eco retain the chosen indicator while the free-session confirmation opens, then run that action once after activation. Hydrology now opens session confirmation when an eligible indicator is selected, restores its AOI in both the drawing and calculation state, and rebuilds the chosen module. Fields Clear results does not require a new processing session. Map inspection requests require an active session. Soil-value errors and rejected Eco actions appear in the UI. Fields location markers use circles without missing default image assets.

Validation: all scripts/test_*.cjs and geocoding/tests/*.cjs pass. scripts/check_indicator_actions.cjs accepts Google Earth Engine algorithm-definition JSON and runs the real EE client against a simulated transport: all four soil buttons, suitability and monitoring actions, climate refresh, and all ten Hydrology modules generate requests. This checks client wiring and expression construction, not real provider results. Live signed-in browser QA, production payment settlement, email delivery and completeness of administrator datasets remain separate launch checks.

## First-point polygon closure and direct session start — 22 October 2026
Fields, Eco and Hydrology close polygons by clicking the teal first vertex after three or more corners (12-pixel hit tolerance). Finish controls are removed. Shared analysis startup uses a limit notice and Start session, with no contact or consent form. Analysis jobs remain tied to the signed-in identity; AOI, time, credit and cost controls are unchanged. Contact details are still required at report checkout.

Live provider test of all four soil map requests returned HTTP 403: Permission earthengine.maps.create denied on projects/ee-gee023. Algorithm discovery and computations can succeed with Resource Viewer, but maps require an additional permission. In Google Cloud Console → ee-gee023 → IAM, the owner must grant sieg-analysis@ee-gee023.iam.gserviceaccount.com Earth Engine Resource Writer (roles/earthengine.writer), or a custom role with the required map/thumbnail/table create permissions alongside existing read/computation permissions. Source: https://docs.cloud.google.com/iam/docs/roles-permissions/earthengine. The website cannot change project IAM. Recheck actual map tiles and reports after that change; successful client wiring is not proof of live provider results.

## Supplied Agri-Intelligence v2 review — 22 October 2026
Compared the supplied 2,565-line proj_001_Agri-Intelligence_v2 script after normalising line endings. Its calculation code was already substantially the same as agri/assets/original-dashboard.js; differences were mostly branding and website/session integration. Kept the existing page markup, CSS, five modules, first-point polygon closure and the supplied climate/forecast methodology.

Changes: no hidden private-asset map requests on initial load; session/AOI matching for automatic Climate, Early Warning and nested crop controls; clearing a boundary removes old map/statistic results; SOC at 0 cm uses source ×5 g/kg and bulk density uses source ×0.01 g/cm³, with AOI means; suitability accepts A–E/numeric/full labels through Suit_, Suitabilt, Suitabilit or Suitability; climate data cached per geometry for 30 minutes; reports require the current confirmed polygon. Google catalogue scale references: https://developers.google.com/earth-engine/datasets/catalog/OpenLandMap_SOL_SOL_ORGANIC-CARBON_USDA-6A1C_M_v02 and https://developers.google.com/earth-engine/datasets/catalog/OpenLandMap_SOL_SOL_BULKDENS-FINEEARTH_USDA-4A1H_M_v02.

The server now preserves coarse-grid centroid fallback only by deriving that centroid from the authorised AOI, replacing any client-supplied centroid geometry. Raster maps remain clipped to the AOI. Integration fixtures exercise four soil buttons, four suitability actions, monitoring controls, all three warning maps, climate and both crop/vegetable branches with the real EE client and simulated results. All standard test suites pass. These tests do not resolve the previously documented Google maps.create IAM denial or prove live data coverage. Crop ranking remains a climate-range screening calculation, not a full agronomic recommendation.

## Unlimited analyses — 22 October 2026 (supersedes all session policies above)
There is no initial-free credit, session quota, 30-minute expiry, Start session control or payment-based analysis unlock. Selecting an indicator automatically creates/reuses an owner-scoped AOI record (policyVersion 3). Users may analyse further AOIs repeatedly. Older authorised/running records are upgraded when reopened and are not blocked by their former expiry. The former five-jobs/hour and 120-requests/job quotas are removed. Payment callbacks no longer issue analysis credits. Report/download fees and delivery checks are unchanged.

Selected-area binding, account ownership, provider request-rate protection, geometry validation, area-size review and caching remain. The first-point closure instructions replace the outdated Draw and finish note; Draw, Clear polygon and full-width Africa controls remain. The session card is replaced by a compact Saved analyses disclosure, with inline status only for actionable messages.

Regression coverage: repeat analyses across Fields/Eco/Hydrology, reuse after a week, no analysis credits, separate paid report creation, concurrent same-AOI reuse, owner isolation, saved-geometry restoration, polygon closure and all indicator fixtures. The Earth Engine IAM requirement for maps.create remains independent of this policy change.

### SIEG Fields weekly crop monitoring

The signup accepts one field up to 10 ha and a recipient email. A free sample
does not activate the E149/month plan. Set the `RESEND_API_KEY` secret and
`REPORT_FROM_EMAIL` to a verified sender, then test one sample with an authorized
recipient. Verify the Sentinel-2 observation summary and map attachment.
The admin-only GET `/api/weekly-crop/admin` lists plan references. After verifying
payment separately and confirming that the schedule works, set
`WEEKLY_CROP_ENABLED=true`. Admins can POST `{id,confirmPayment:true}` to that
same endpoint from the site origin to activate or renew a month of service.
There is no recurring card charge. Users can stop updates in Fields.

The owner-only Site tool `run_weekly_crop_monitoring` supports `dryRun:true`
to check credentials without email. Once the tool is connected and exercised,
run it at frequent intervals so each subscriber’s selected field-local delivery time can be honored. The runner sends only due updates, once per plan per week. Each call processes up to two plans; repeat
while the result reports more, passing its cursor on each subsequent call. Plans created before field time zones were introduced need their schedule saved again before delivery. Review failures and the email provider's daily
quota before accepting additional paid subscribers.

### SIEG Learn teacher pilot

Open **Teacher plans** to see the free Form 2 English sample and request
Teacher Studio (E79/month, 30 lesson credits), the English revision pack
(E39 once), or School Pack (E499/month proposed, interest only).
Requests do not charge anyone. Student Studio, book previews and study
groups have no billing.

A signed-in SIEG administrator can open **Manage pilot requests** in Teacher
plans. Confirm an offline payment and enter its reference before unlocking
the pack or a month of Studio access. An expired Studio period can be renewed
using a new payment reference. School requests are for follow-up and require
separate onboarding; there is no automatic seat provisioning or recurring billing.

Teacher plans use the country saved in the signed-in Learn profile. Prices
are converted from SZL using cached ExchangeRate-API rates. The amount and
currency are saved with the request; changing the account country does not
rewrite an existing request. Form 2 English is ready to download after payment
confirmation. For other subject and grade combinations, prepare the requested
pack and upload its PDF while confirming payment. School Pack requests are
handled through separate onboarding. Student access has no billing.

### Experts work availability and 90-day reminders

Experts select work availability when submitting a profile and can edit it in **My availability** on `talent-pool.html`. Only the submitting signed-in account can change a profile. Availability updates preserve publication review state. The current trade catalogue is `assets/expert-trades.json`; Experts service prices are in SZL.

Reminder emails are optional and go to the verified email of the signed-in account, never an arbitrary profile contact. Saving availability resets the next reminder to 90 days later. Turning reminders off clears the next due date and recipient. Existing profiles receive no reminder until their owner enables it.

Configure production `RESEND_API_KEY` and `REPORT_FROM_EMAIL` using a verified sender. The authenticated admin MCP tool `run_expert_availability_reminders` checks readiness with `dryRun: true`. A daily linked task calls it without dryRun, continuing with returned cursors while `more` is true. Only opted-in approved or pending-review profiles whose per-profile due date has passed are emailed; runs claim records atomically and use provider idempotency keys. Successful delivery sets the next due date 90 days later. No source rebuild is needed to run a reminder. A missing email configuration returns `configuration_missing` without sending.
