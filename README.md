# SIEG — Beyond the Vision

Python-powered homepage in navy, teal, beige and white. Includes the supplied
SIEG logo and four product areas. Inspired by the provided WSP layout, with
original SIEG copy and graphics.

## Run
Requires Python 3.10+; no pip dependencies.

```bash
python app.py
```

Open http://127.0.0.1:8000. Use --port 8080 to change port. Ctrl+C stops the app.

## Build and host

```bash
python app.py --build
```

Upload the contents of dist/ to your static hosting service. To use
www.sieg.ltd, configure your domain with that hosting provider. The preview
URL is separate; this project does not configure or claim domain ownership.
The Python server is for local use and binds to localhost.

## Customize
- Edit home.html for text and styling.
- Edit site_config.json for product links.
- Replace assets/sieg-logo.png or assets/landscape.jpg to change imagery.
- Rebuild after changes.

SIEG Eco and Talent / expert pool are described as planned
product concepts, not live services. Land suitability links to the supplied
SIEG Fields dashboard. SIEG Estate links to the sample-data
page created in the preceding task; it may require the owner's signed-in access.

The enquiry form builds and downloads a text draft locally. It does not send
messages, collect submissions or store personal data on a server. A real contact
service or confirmed recipient needs to be configured before enabling delivery.

## Assets
The logo was supplied by the user. Landscape photo downloaded from Unsplash:
https://images.unsplash.com/photo-1500382017468-9049fed747ef
The landscape is illustrative, not identified as Eswatini. Product graphics
are original SVG illustrations embedded in the HTML. Images are bundled for
self-contained hosting; the page does not use external fonts or scripts.

## Verification
Python build, asset references, configuration and JavaScript syntax checked.
Browser visual QA was unavailable in this environment.

## Five-service update
The Python build now creates the homepage and five service pages:
SIEG Fields, SIEG Eco, SIEG Estate, Energy Generation,
and Talent Pool. Every page uses footer.html, including the ordered five-service
navigation from the supplied reference. Edit footer.html once and rebuild to
update all pages.

## Testimonials
The homepage has a manual carousel near the bottom. It currently displays
clearly labelled placeholders rather than invented endorsements. To publish
approved quotes, add up to five records to site_config.json testimonials:
{"quote": "Approved client quote", "name": "Client name", "role": "Role / organization"}
Slots correspond to the five service categories in reference order. Rebuild
with python app.py --build after editing. No automatic rotation is used.

## Contacts
Footer uses support@sieg.ltd, Mzimnene complex, Manzini and the supplied
cellphone text +268760284620. The phone is displayed as supplied, without
assuming a corrected dialable format. Email links open the visitor's email
app; the website does not send messages itself.

## Integrated SIEG Eco
The existing Earth Engine dashboard is bundled under enviro/ and exposed at
/enviro-intelligence.html within the main SIEG site, with the common menu and
footer. The older environmental-monitoring.html URL opens the same page.
The workspace retains its six modules, map, legends, chart and CSV controls.
Live Earth Engine calculations require authorization and were not run during
this integration. Register the main site's origin (not the earlier standalone
site origin) in the Google OAuth web client's authorized JavaScript origins.
Tokens remain in memory; no credentials are embedded. Preserve the original
source and data attribution. See enviro/ for the bundled existing implementation.

## SIEG Fields integration
The supplied 2,567-line Earth Engine script is bundled unchanged in
agri/assets/original-dashboard.js. A browser UI adapter translates its Panels,
Labels, Buttons, Selects, charts, map layers and drawing geometry into HTML and
Leaflet. Five original tabs load after Earth Engine authorization. Includes
polygon input, village zoom, map layers, legends, crop/vegetable screening,
climate charts and forecast warning cards. Charts are rendered as labeled bars
with original numeric values. Live calculations were not executed during QA.
The Google account needs access to all three private Eswatini assets and the
Earth Engine project. Register the main website origin with your OAuth client.
Original sources and calculation caveats are preserved. No artificial results.
The app is integrated at agri-intelligence.html; land-evaluation.html is an alias.

## Integrated SIEG Estate
property-explorer.html embeds the Eswatini property search under the main site
with its shared menu and footer. The older property-selection.html opens the
same experience. The property folder bundles sample records and a natural-
language query interpreter for town/region, type, price, area and bedrooms.
Query results update the cards, table, map pins and illustrative land rectangles.
Unsupported amenities, ownership and proximity criteria are explicitly flagged.
This interpreter is rule-based, not an LLM or a connected AI model. A genuine
AI model integration still requires a secure backend and authorized model access;
no API keys are placed in the browser. All 32 records and footprints remain
synthetic and must be replaced with licensed listings and cadastral geometry
before real property search or land-rights use. Sample queries were checked.


## SIEG Experts
Open `talent-pool.html` for eight trades: Surveyors, Draughtsmen, Bricklayers, Carpenters, Plumbers, Electricians, Tilers and Housekeepers. Sixteen clearly labelled illustrative profiles support skill, trade, location and availability filtering, profile details and a browser-local shortlist. Project briefs and talent applications download as text drafts; no applications, hiring requests or bookings are transmitted. No profiles, qualifications or availability are verified. Edit `talent/profiles.json` to replace demonstration content with approved real records. Python builds and serves the site; directory interactions run in the browser.

SIEG Fields and SIEG Estate now share SIEG Eco surface styling: 10px dashboard corners, 12px dialogs, 5px controls, softer borders and shadows, navy/teal accents and responsive workspace gutters. Analysis and search behavior are preserved.

Talent sample profiles use a responsive scroll-snap slider with previous/next controls, swipe, keyboard arrows and reduced-motion support. Filtering updates the slider and its count. Every top-level website page has a floating back-to-top control after scrolling.

## Energy Generation
A Generac-inspired stationary generator catalogue integrated at energy-generation.html. Eight illustrative diesel, gas and bi-fuel configurations support keyword, fuel, output and application filters, sorting, detail dialogs and comparison. All ratings and diagrams are conceptual and unverified. No supplier relationship or equipment availability is claimed. The enquiry form downloads a browser-generated text draft without submitting or storing personal details. Shared navigation, footer and back-to-top are included.

Homepage service card titles stay on a single line. Explicit breaks were removed from Energy Generation and SIEG Experts; responsive card widths and heading sizes preserve full labels without clipping.

Homepage services: three cards on the top row, two centered below on desktop; two columns on tablets and one column on phones. Single-line service names are retained.

SIEG Fields layout now follows SIEG Eco: five accessible module tabs are visible before authorization, area controls and analysis actions share a sidebar, and the rounded map includes a title, basemap switch and status bar. On connection the supplied GEE controls mount into this layout. The latest attachment matches the bundled source byte for byte; calculations remain unchanged. Live Earth Engine authorization was not exercised in this update.

Original GEE code download links are removed from the website. The Agri sidebar now offers Request SIEG Fields Report, opening an email draft addressed to support@sieg.ltd with location, area, intended use and contact fields. The visitor sends the email themselves.

## Standard SIEG Fields Report
The Agri report form collects name, email, country and cellphone (Eswatini +268 default). A connected Earth Engine session and finished polygon are required. It runs the supplied soil, suitability, monitoring, climate, warning and crop/vegetable actions, captures descriptions and available PNG maps, and downloads a self-contained HTML report with Print / Save as PDF. Unavailable analyses are explicitly marked. Crop rankings use climate bands only. Reports may take several minutes; leave the workspace idle while generating. Live Earth Engine report generation has not been tested with an authorized account.

Automatic email is NOT enabled on the static hosted site. `report_service.py` implements an optional Python SMTP endpoint sending the request and attached report to support@sieg.ltd and bank details to the requester. Configure SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM and REPORT_ALLOWED_ORIGIN on the server, host it behind HTTPS, set report_api_url to its /api/land-report endpoint and rebuild. Never commit credentials. SMTP delivery and live generation remain untested. Bank supplied by owner: First National Bank; branch 281264; account 622 7180 9067. No fee was provided; the email instructs the requester to confirm the fee/reference before payment. The static preview supports report download and a manual email draft; report attachments must be added manually to that draft.

Report cellphone input is a single joined field: country/calling-code dropdown and phone number input. Eswatini +268 is the default; the selected code is included in report and email payloads.

Analysis area uses a joined African-country dropdown (54 countries; Eswatini default) and typed village input. Search or Enter invokes Photon OSM geocoding, restricted by country; matches move the map without changing the drawn analysis polygon. Requests are explicit, throttled and session-cached. The configurable place_search_url uses the Photon public demo, whose availability is not guaranteed; deploy a private provider for high traffic. Eswatini-only soil assets are labelled. No Google Maps data is used. Live place lookup was not tested from this environment.

Agri introduction now refers to Africa. The supplied-code instruction sentence is removed. Initial and Home map views show Africa, and the home control label reads Africa. Country selection still defaults to Eswatini; Eswatini-only dataset identifiers and coverage notices are preserved for accuracy.

SIEG Eco now uses the African-country/village OSM search field, and a workspace Connect Earth Engine button replaces the module-count badge. The repeated introductory instruction/connection/attribution row is removed. Authorized country changes rebuild the analysis engine and national boundary for the selected country. Data coverage varies by indicator; live country analysis remains untested.

SIEG Eco now starts with an Africa continental overview and supports Africa or individual-country boundaries. Village results use OSM data; continent searches are restricted to an Africa bounding box and available country codes. Coverage depends on each dataset. Continental calculations can exceed Earth Engine limits; choose a country or smaller polygon for detailed analysis. Live continental analysis remains untested.

Enviro module controls now match Agri: compact two-column buttons, 7px gaps, 5px corners, 11px labels, teal selection and 310px sidebar. Tablet layout uses three columns; narrow phones return to two. Connection button stays visible on mobile.

Enviro has a Request Environmental Report button directly below Analyse area. It prepares an email draft to support@sieg.ltd with the current area and analysis settings; the visitor completes contact details and sends the draft.

Environmental report requests now collect contact details and package the latest successful selected evaluation (not a fresh batch of every indicator) with available map and source descriptions. CSV download control is removed. The optional SMTP endpoint /api/environment-report sends contact details and evaluation attachment only to support@sieg.ltd; its requester email body is exactly the supplied bank details, without the evaluation attachment. Set environment_report_api_url after hosting/configuring the SMTP service. Automatic delivery remains disabled until configured; live EE map capture and SMTP sending remain untested.

Enviro Analysis area now joins Select country and Select Admin 2. Once authorized, WM/geoLab/geoBoundaries/600/ADM2 is filtered by the selected country ISO3 shapeGroup, names are sorted, and selecting a feature defines the evaluation region and zooms to its boundary. Country changes clear the previous selection. Missing coverage and authorization states are explicit. Live Earth Engine ADM2 loading remains untested.

Enviro Season and Statistics scale controls sit side by side in a two-column row matching Analysis year and Baseline year.

Environmental and SIEG Fields report buttons are positioned at the right of the beige insights/context panel beneath each map, following the supplied reference. On narrow screens the buttons stack within that panel.

Report buttons are vertically centered in their beige panels, using a teal fill, white text and a darker teal hover state.

Location workflow revised on both dashboards: choose country (zoom), search village (zoom), draw polygon (analysis region). Enviro analysis and evaluation requests require a finished polygon; no automatic national/Admin2 analysis geometry is assigned. Country changes clear old polygons. Live country geocoding and authorized analysis remain untested.

Enviro locator uses country and geoBoundaries ADM2 dropdowns. ADM2 selections zoom the map only and never assign the analysis geometry; a finished polygon is still mandatory. The centered LOCATE YOUR AREA FIRST heading is shared with Agri.

Enviro offers two exclusive analysis modes: selected ADM2 boundary or a custom polygon clipped to that ADM2. Starting polygon drawing clears prior results, invalidates pending requests and clears the active analysis geometry until finishing. Selecting another ADM2 replaces prior polygon/results. Report requests use the latest successful active-mode result.

Enviro area selection redesigned as two compact cards: labelled country/Admin2 selectors and a separate polygon option, with a subtle divider, teal drawing action and current-area status.

## Property entry and area insights
SIEG Estate supports up to five compressed photos, a joined Village/Region field, SZL value and one GPS point or three-plus boundary vertices. Mobile GPS requires permission and HTTPS (or localhost); accuracy is shown, and user boundaries are not surveyed. Hosted static preview uses explicitly labelled local role drafts without authentication. For actual Admin/Client login, run app.py --build then property_service.py with PROPERTY_ADMIN_EMAIL and PROPERTY_ADMIN_PASSWORD; clients can register (minimum 12-character password), login and save listings in SQLite. Admin and client record access is enforced by the service. Production needs HTTPS hosting, secure-cookie setting PROPERTY_HTTPS=1 and PROPERTY_ALLOWED_ORIGIN. No account service is deployed with the static site.

Circular count clusters replace price pins. Filters, listings and insights scroll independently, while the map remains fixed within the workspace. Weather uses Open-Meteo at selected property/map coordinates. Explicit 5 km queries use Overpass OSM data for roads, health facilities, shops, schools and public transport. Summary downloads report mapped counts and nearest straight-line distances; road counts are ways, and results are not travel times or proof of available services. Public services may throttle; weather/OSM requests and phone GPS have not been exercised live. Consult Open-Meteo service terms before commercial deployment.


## SIEG Address
Open `eswatini-geocoding.html`. Select a geoBoundaries Eswatini ADM2 polygon and upload a ZIP containing one point shapefile (.shp/.dbf/.shx/.prj, optional .cpg), or a WGS84 point GeoJSON. Map name and surname columns. Uploaded records are processed in the browser session, with no remote upload or persistent record storage. Overpass receives the bounding box only. Leaflet/shpjs are pinned CDN dependencies requiring internet access.

Each eligible OSM highway way is a separate allocation unit (not a merged physical street). Default direction is from the western endpoint to the eastern endpoint, south to north for longitude ties; reverse is available. Road arrows identify direction. The first matched right-hand homestead by distance along the road supplies the allocated street surname. Keep original OSM names as reference. OSM way IDs distinguish duplicate street surnames. Right side uses odd numbers; left side uses even numbers. Format: Admin2 / AnchorSurname Street · OSM wayID / ka-OwnSurname / homestead number. Points within one metre of the road, missing names, outside ADM2, missing roads and absent right-side anchors are flagged for review.

These are provisional SIEG identifiers, not official addresses, postal registrations or edits to OSM. The match uses straight-line proximity to locally projected OSM road segments, not driveway or routing connectivity. Default maximum distance is 100 m (adjustable). Additions, changed data, changed direction or settings may renumber homes. Inputs: up to 5,000 points and 20 MB. Outputs: annotated point GeoJSON and spreadsheet-safe CSV containing names and coordinates. Share exported personal data intentionally.

Sources: geoBoundaries gbOpen SWZ ADM2 API (source attribution/licence shown at load time); OpenStreetMap via Overpass, ODbL; OSM / Esri basemaps. If boundary API fails, a downloaded geoBoundaries ADM2 GeoJSON can be uploaded. An unavailable or incomplete roads response produces an error rather than fabricated addresses.

Energy Generation has been removed. The eight services are SIEG Fields, SIEG Irrigate, SIEG Hydrology, SIEG Eco, SIEG Estate, SIEG Address, SIEG Learn and SIEG Experts.


## Upload-once website resources
The hosted geocoding page now has private shared Resources: save one Admin2 boundary dataset and one homestead dataset, then choose Use saved data on future visits/devices. ZIP shapefiles are converted once in the browser; original file bytes and converted WGS84 GeoJSON are kept in the website R2 binding. No dataset is supplied by default. Uploads require a signed-in visitor within the owner-private Site access boundary. Resource replacement is explicit; save-once will refuse to overwrite. OSM road queries remain live. The Python website can still be previewed with python app.py, but shared resource storage requires the hosted Worker. Build hosted output with python scripts/build_worker.py. The generated Worker embeds static website files and exposes /api/geocoding/resources. This migrates the hosting configuration from static to Worker; r2 binding is BUCKET. Preserve the private audience for named homestead data.


## Shared Earth Engine analysis (current authentication)

SIEG Fields, Eco and Hydrology now initialize automatically through the same-origin
`/api/earth-engine` server route. Visitors never enter Google credentials. The old
visitor OAuth instructions above are superseded. No service credentials are included
in this repository. Without configuration the dashboards show an unavailable status.

Production runtime secrets required:
- `GEE_PROJECT_ID`: the Earth Engine registered Google Cloud project ID.
- `GEE_SERVICE_ACCOUNT_JSON`: the complete service-account JSON, stored as a secret
  through the Sites runtime environment configuration, never in source or browser code.

Enable the Earth Engine API, register the project for its appropriate commercial or
noncommercial use, and grant the service account Earth Engine Resource Viewer and
Service Usage Consumer as needed. Give it read access to the private assets used by
Fields (Eswatini_Admin1, Eswatini_Villages and Eswatini_Soils). Never place a key file
in the downloadable website assets or paste it into a public form. Rotate/revoke any
exposed key. A Google Cloud deployment using an attached service account and ADC is
the preferred alternative when moving the analysis server to Cloud Run.

The Worker obtains and refreshes Google access tokens internally. Only allowlisted
read/compute/map/download operations for the configured project are proxied; exports,
asset writes and IAM changes are rejected. The current private Site's sign-in boundary
is preserved. Visitors do not need an Earth Engine account. Live verification requires
a configured service account; mocked tests do not verify project registration, quotas,
asset permissions, Google billing or dataset availability.

## Analysed-area reports and downloads

Fields, Eco, Hydrology and Estate accessibility HTML reports use `assets/report-kit.js`.
They include the supplied company-folder artwork on front/back covers, a linked table
of contents, print-to-PDF styling and self-contained map images. Cartographic figures
are north-up EPSG:3857, masked to the analysed geometry, and contain a north arrow,
legend, source references, a centre-latitude scale bar, rounded borders and the
requested map credit `support@seige.com`. The company artwork retains its original
contact information. Geometry coordinates in data downloads remain EPSG:4326.

Earth Engine map rasters are clipped before rendering. HydroBASINS spatial exports
intersect feature geometries with the current analysed AOI and omit full-basin area
attributes; monthly nonspatial statistics retain their AOI-based calculations.
Address allocation/downloads include only homesteads inside the analysed boundary.
Estate property CSV downloads require a completed 5 km accessibility AOI and include
only matching property points inside that area. Map movement alone does not expand
an analysed export. Missing data or rendering errors are identified rather than
substituted with fabricated results. EPSG:3857 scale varies away from the centre.

Run `node scripts/test_report_cartography.cjs` for geometry and map-template checks.
Live Earth Engine report verification still requires service-account configuration.

## Report collection and card fulfilment (current)

The current flow supersedes the earlier manual download / bank-transfer instructions above. All analysed-area report and export controls offer cash collection or Visa checkout with verified-payment email delivery. Introductory whole-area prices are Fields USD 21, Eco USD 18, Hydrology USD 27, Estate USD 9 and Address USD 12 per request (not per hectare). See REPORT_DELIVERY.md for configuration and limitations. No live payment/email credentials are currently configured. Collection requests can be retained in the private Resources print queue; they are not claimed to be printed until staff mark them ready.

## Current hosted operations

See OPERATIONS.md for the current account, property, expert and enquiry workflows. These replace the older Python-only account and downloadable-draft descriptions above. D1 stores reviewed records; R2 stores protected photos. Resources now provides review queues and configuration status. Live Earth Engine, payment/email credentials, real datasets and end-to-end validation remain pending.


## SIEG Irrigate and SIEG Learn

- Irrigate: `/irrigation.html`. Country/place search, field polygon, optional Earth Engine soil/terrain assessment, configurable recommendation, local water/hydraulic calculations, clipped preliminary rows, editable materials/labour BOQ and design-review enquiries. Soil/terrain use the existing Earth Engine secrets. Report requests use the shared collection/card flow and an AOI-bound branded HTML report. The Irrigate report fee defaults to the Fields fee; set `REPORT_PRICE_IRRIGATION` (integer USD cents) to override. Analysis remains unpaid until a report is requested. Preliminary estimates require engineering verification.
- Learn: `/education.html`. Personal book/lesson storage uses IndexedDB on the visitor’s device, not a hosted school library. PDF/text books up to 30 MB; PDF extraction up to 20 selectable-text pages per lesson. No publisher content or subscriptions are bundled. L4 sample lesson reflects the supplied sample teaching structure.
- PDF and editable PPTX generation run locally using vendored jsPDF 3.0.3 and PptxGenJS 4.0.1. PDF.js 5.4.296 extracts selected pages. Original vendor licence headers are retained.
- AI mode is optional and server-only: add hosting secret `OPENAI_API_KEY`; optional `EDUCATION_AI_MODEL` defaults to `gpt-4.1-mini`. The `/api/education/status` response enables AI mode only when configured. The current deployment has no AI key; guided templates, editing, saving and file generation remain usable.
- AI sends only selected extracted text/notes plus lesson inputs after explicit consent. No provider key enters client code; daily allowance is 20 AI requests per signed-in user, stored in existing D1 records. Failed provider calls count toward the allowance.
- Existing Geocoding URLs and backend `address` IDs remain compatible; the visible service name is SIEG Address.

Irrigate layouts include connected main/header routes, proposed pump house, filter/inlet, zone valves, flush points and optional storage. Pump placement is editable inside the AOI. Routes stay within the polygon, using visibility routing around concave edges; they do not account for actual obstacles/easements. Main and header BOQ quantities reflect routing plus declared allowances. Maps cap display at 1,500 row segments and 20 valve icons. Report maps have scale, north, legend, projection, sources and company wrapping.


### Irrigate price references and currency

BOQ defaults are dated US retail benchmarks in `irrigation/pricing.js`: Menards pipe, DripWorks tubing / fittings / valves, The Drip Store emitters / filter, plus a separately labelled BLS US wage reference with SIEG crew-time assumptions. The catalogue references are explicitly dated 2024; these are not live supplier quotes or a hydraulic product selection. Custom pumps, enclosures, storage/base and earthworks remain quote-required. Unpriced rows are excluded from priced totals and explicitly flagged. No freight, import duty or contractor overhead is implied.

Country selection defaults the BOQ to its ISO currency. USD rates convert using ExchangeRate-API, cached for 24 hours, with the actual FX date recorded in the report. A cached older rate is labelled; without any usable conversion, supplier benchmarks are left unpriced in local currency and manual local rates still work. Local edits are saved in browser storage per country and BOQ item, are reused on recalculation, and can be reset to the US benchmarks. The dashboard Quantity column shows ** instead of numbers; actual quantities are retained in the generated report, together with sources, rates, FX and assumptions. Fields yield target year defaults dynamically to the current UTC year; historical records default to the preceding three years. Incomplete seasons remain blocked rather than being treated as full-season observations.


### SIEG Learn teacher, student and community workspaces
Teachers can upload up to three resized topic photos for multimodal lesson generation, select from the uploaded ESL game bank plus original subject adaptations, and retain the editable PDF/PPT workflow. Guided mode adapts a chosen game locally; image interpretation requires AI mode. Student studio accepts pictures and selected PDF pages (scanned pages rasterized), generates original practice questions with answer explanations, and supports six follow-up exchanges per session. No promise of predicting real exams. AI routes require OPENAI_API_KEY and use the existing EDUCATION_AI_MODEL setting; teacher and student calls share a 20/day/user allowance. Material is sent to the provider only on explicit consent, not stored by the SIEG server. Conversations are in memory; books/lessons stay in browser storage.
Study rooms persist through D1 siege_records with authenticated membership, unguessable invite codes, bounded latest-100 message retrieval, visible-page polling, leave, own/creator deletion and report flags. The configured site administrator can review/remove reported messages inside Study groups. Group codes grant membership: share privately. No live moderation or automatic email notifications. Existing owner-private site sharing still controls who can access; it has not been widened.


### Worldwide GIS scope — 29 October 2026
Fields, Irrigate, Eco, Hydrology and Geocoding share a 250-country/territory ISO catalog (mledoze/countries, https://github.com/mledoze/countries; country/currency/calling-code data). Estate adds worldwide country/Admin2 navigation, global weather/accessibility queries and country/currency listing fields. Experts is unchanged. Initial Africa map positions are preserved; Hydrology no longer auto-zooms to Eswatini during its initial outline fetch. Africa overview uses selector AFRICA so Afghanistan (AF) remains selectable.
GeoBoundaries ADM0/ADM2 and HydroSHEDS basin queries filter by selected country/locality globally, with unavailable-coverage states. Hydrology and Eco rainfall use global ERA5-Land daily precipitation (metres converted to millimetres), replacing tropical CHIRPS. Terrain retains SRTM with coarse ETOPO1 ice-surface elevation fallback outside its footprint; the fallback is not high-resolution design/survey terrain. Fields outside Eswatini uses an explicitly labelled preliminary slope/clay screening model instead of the private Eswatini suitability asset. GEDI, soils, optical imagery, boundaries and other products retain their real source masks and dates; worldwide navigation does not guarantee every indicator in every place. No user data, boundaries or estimated values are fabricated where source data are unavailable.
References: https://www.geoboundaries.org/api.html ; https://developers.google.com/earth-engine/datasets/catalog/WWF_HydroSHEDS_v1_Basins_hybas_6 ; https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR ; https://developers.google.com/earth-engine/datasets/catalog/NOAA_NGDC_ETOPO1 .


### Fields global suitability — 29 October 2026
Outside Eswatini, Land suitability now builds a 250 m screening layer from ISRIC SoilGrids 2.0 (projects/soilgrids-isric/phh2o_mean, clay_mean, soc_mean), with thickness-weighted 0–30 cm bands (5/10/15 cm weights) and documented unit scaling. OpenLandMap v02 at 10 cm (pH/10, clay %, SOC ×5 g/kg) is an explicit alternate provider, never silently presented as the same depth/model. Copernicus GLO30_2024_1 terrain follows the catalog native-projection mosaic pattern; SRTM is an alternate on request failure. Slope, erosion and irrigatability controls also use Copernicus terrain with SRTM gap fill. WorldCover 2021 excludes built-up, water and ice on the 250 m output grid.
The global model uses the most limiting of four explicit scores (pH, clay, SOC and slope), with five categorical screening classes. These are SIEG rules for generic soil/terrain potential, not validated crop-specific suitability or official FAO classes. Missing source pixels remain unclassified. Area summaries show coverage and class hectares. Low coverage triggers attempts using the alternate soil/terrain pair; the best available coverage is retained and source/depth differences disclosed. Full thresholds, dates, licences and limitations enter requested reports; the dashboard retains concise source and coverage information.
Eswatini retains its local soil A–E classification. Missing/inaccessible/empty local classification triggers the global method. Async callbacks are cancelled on reset and protected against changed AOIs.
Validation: node scripts/test_land_suitability.cjs /path/to/google-earthengine-algorithms.json uses the official Google earthengine-api algorithm fixture, actual EE serialization and simulated provider replies. It covers multiple continents, source fallbacks, no-data/coverage, projection inputs, cancellation, real result rendering and report provenance. Live upstream computation could not be validated in this session because the hosted analysis endpoint required sign-in.
Primary documentation: https://docs.isric.org/globaldata/soilgrids/access_on_gee.html ; https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html ; https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30_2024_1 ; https://developers.google.com/earth-engine/datasets/catalog/OpenLandMap_SOL_SOL_PH-H2O_USDA-4C1A2A_M_v02 ; https://developers.google.com/earth-engine/datasets/catalog/OpenLandMap_SOL_SOL_ORGANIC-CARBON_USDA-6A1C_M_v02 .


### Spatially referenced AOI uploads — 30 October 2026
Fields, Irrigate, Hydrology and Eco have Upload boundary directly below their Draw polygon controls. Supported files: zipped shapefile or matching .shp/.prj with optional .dbf/.shx/.cpg; GeoJSON/JSON; polygon KML; closed GPX track/route. Total input limit 30 MB. Shapefile ZIPs require a matching non-empty .prj and have an expanded-size cap; the vendored shpjs 6.1.0 parser runs in a Web Worker and reprojects supported .prj definitions to WGS84. GeoJSON uses its standard EPSG:4326 reference unless an explicit supported CRS is supplied. GeoJSON and WKT accept explicit EPSG:3857 (converted) or EPSG:4326/CRS84. Other references must be converted in GIS software or supplied as a referenced shapefile. No missing CRS is guessed for shapefiles or WKT.
The picker lets users choose a polygon feature before applying it. The input files stay in browser memory; only the selected geometry is used for normal analysis/report processing. Polygon closure, coordinate ranges, self-crossings, ring crossings, vertex budgets and existing AOI limits are validated before replacing the area. Fields/Eco/Hydrology preserve multipart polygons and holes. Irrigate rejects holes/multipart fields and boundaries beyond its 299-corner design limit rather than silently dropping areas. AOI latitude ±85° and antimeridian restrictions match the existing server policy. Existing results/drawing state are reset when a boundary is applied.
Dependency: shapefile-js 6.1.0, Calvin Metcalf and contributors, MIT (assets/vendor/LICENSE-shpjs.txt); https://github.com/calvinmetcalf/shapefile-js . Run node scripts/test_aoi_upload.cjs after generating the referenced shapefile fixtures described by the test setup.

### Catchment delineation and paid GIS downloads
Hydrology section 03 reads the native HydroSHEDS 03DIR (~90 m) or 30DIR (~1 km) flow-direction grid for the visible map extent. Users place an outlet, snapped within three native cells to the greatest window-local contributing area. A D8 upstream trace produces the catchment and drainage segments. Streams/rivers are modelled threshold classes based on contributing km² computed inside this window, not surveyed watercourses. The native grid is not resampled. Limits: 512 cells/side, 160,000 cells total, 50,000 km², no antimeridian crossing, source coverage required. Edge truncation and adjacent missing data require an explicit acknowledgement before requesting an incomplete package. Changing map extent, outlet or thresholds invalidates the download.
The ZIP contains catchment_boundary.geojson, rivers.geojson, streams.geojson, metadata.json and README.txt (EPSG:4326), with processing extent, thresholds, outlet, source, licence attribution and limitations. Payment/delivery uses the existing report-order flow with service `catchment`, kind `download`; no direct download link is exposed. The fee inherits Hydrology unless REPORT_PRICE_CATCHMENT is configured (integer minor currency units). Card files are emailed only following verified payment; collection files go to the office with cash-before-release instructions. Live card/email requires the existing provider secrets.
Source: https://www.hydrosheds.org/products/hydrosheds and https://developers.google.com/earth-engine/datasets/catalog/WWF_HydroSHEDS_03DIR. Tests: node scripts/test_delineation.cjs; node scripts/test_report_delivery.cjs.

### Irrigate terrain-oriented laterals
The optional Assess Your Land section starts collapsed and closes after successful assessment or when the design form receives focus. Design calculations always resolve terrain orientation from separate Copernicus GLO-30 2024_1 and SRTM 30 m assessments. NASADEM (reprocessed SRTM, not an independent third vote) is a fallback if SRTM fails. Copernicus water-body pixels are excluded. Terrain derivatives retain the DEM projection and use a 3×3 native-pixel median filter for noise reduction; there is no claim of finer resolution. Raw/filtered slope-weighted aspect, at least nine samples and 80% valid field coverage are checked. A raw/filtered directional change over 25° or cross-source difference over 30° requires surveyed direction or subdivision into terrain zones. These are SIEG screening thresholds, not validated error limits. Single-source estimates are explicitly limited. Nearly level land (<0.2%) uses reference N–S rows. Source agreement is labelled, with full diagnostics and method details in report inputs. Terrain remains approximately 30 m radar-derived surface elevation: trees, buildings, complex relief and small fields can bias it. Parallel straight laterals follow a bearing perpendicular to the dominant downslope direction, not surveyed curved contours; surface furrows still require a controlled longitudinal grade. Geometry-scoped terrain results are reused when moving the pump.
Tests: node scripts/test_irrigation_terrain.cjs. Sources: https://www.fao.org/4/s8684e/s8684e07.htm ; https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003 ; https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30_2024_1 ; https://developers.google.com/earth-engine/datasets/catalog/NASA_NASADEM_HGT_001 . Live GEE processing and ground accuracy have not been verified in this environment.

### Shared map workspace
Fields, Irrigate, Hydrology and Eco share grouped location/search/zoom/fit controls and a Layers menu. The AOI upload card is centred on the canvas; accepting a drawn/uploaded area hides it and Change area restores it. Existing area limits apply (Fields/Irrigate 100 ha; Hydrology/Eco 1,000 ha). Layer visibility uses the current authorized analysis only. Irrigate uses the existing irrigation report fee before design calculation; report delivery reuses that purchase.

Place search runs only on explicit submission, through `/api/map/places`. It uses the Photon public demo by default, with a shared rate guard and seven-day query cache in R2. This demo has fair-use limits and no availability guarantee; set `PLACE_SEARCH_URL` to a dedicated HTTPS Photon endpoint as traffic grows. Device location is never sent to the search provider. No public Nominatim endpoint is used. MERIT catchments still require the configured Earth Engine asset.
