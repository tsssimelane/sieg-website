// ============================================================================
// SIEG Eco | Version 2.7 | Google Earth Engine JavaScript
// Developed for Thembinkosi Samuel Simelane | October 2026
// ============================================================================
// HOW TO RUN
// 1. Open https://code.earthengine.google.com/ with an enabled Earth Engine project.
// 2. Paste this ENTIRE file into a new script and click Run. No imports required.
// 3. Choose Eswatini, a global Admin2 area or a drawn polygon, then a subtab.
// 4. Click ANALYSE AREA. Charts/results appear ON the map; map zoom is preserved.
// 5. Draw a polygon, then click USE DRAWN AREA to analyse an outline-only region.
// Visible tabs match the supplied layout: Land classification, Biodiversity,
// Land degradation, Air quality, Urban growth, Active fires.
//
// IMPORTANT METHODS
// - Default year is the last complete calendar year. Dates are evaluated at run.
// - Dynamic World mean class probabilities are classified using argmax, with a
//   confidence threshold. Missing observations remain masked, never class zero.
// - Habitat cover is a land-cover proxy, NOT measured biodiversity or naturalness.
// - S5P values are atmospheric columns/index, NOT ground concentrations or AQI.
// - Water indices are dimensionless proxies, NOT NTU, mg/L or drinking safety.
// - Fires use recent time, independently of the historical year/season controls.
// - Degradation trends are screening indicators, NOT an official SDG assessment.
// - Stats are sampled at the selected analysis scale. Map sources retain their
//   nominal resolution. Reprojection does not improve source spatial resolution.
// - Async responses are guarded so old results cannot overwrite a new analysis.
// - Empty collections use fully masked seed images; chart gaps stay missing.
//
// DATA ATTRIBUTION / DOCUMENTATION
// Dynamic World: Google, National Geographic Society, World Resources Institute.
// https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1
// Copernicus Sentinel-2 / Sentinel-5P: European Union / ESA / Copernicus.
// NASA FIRMS / LANCE: NRT VIIRS 375 m VNP14IMGT / VJ114IMGT Collection 2.
// https://developers.google.com/earth-engine/datasets/catalog/NASA_LANCE_SNPP_VIIRS_C2
// NASA FIRMS NRT data are not science quality. Detections need verification.
// MODIS MOD13Q1: NASA LP DAAC. CHIRPS: UCSB/CHG. SRTM: NASA/USGS/JPL.
// geoBoundaries 6.0: William & Mary geoLab, CC BY 4.0.
// BII v1.1: Gassert, Mazzarello & Hyde (2026), Impact Observatory / Vizzuality;
// hosted by Earth Blox, CC BY 4.0. Annual 100 m models, 2017–2025.
// https://gee-community-catalog.org/projects/bii/
// CSIRO BILBI ecosystem condition (2000–2024), CC BY-NC-SA 4.0.
// OpenLandMap SOC v02: Hengl & Wheeler (2018), CC BY-SA 4.0; stored units ×5.
// Administrative analysis uses public geoBoundaries global ADM2, filtered to SWZ.
// No private boundary asset or imports are required for Admin2 analysis.
// Activity counts are satellite screening cells / detection cell-days, not events.
// Please retain these attributions when publishing this dashboard.
// ============================================================================

// OPTIONAL ASSETS. Leave null for a completely public-data dashboard.
var CONFIG = {
  boundaryAsset: null,       // Optional Eswatini ADM1 FeatureCollection asset ID.
  regionField: 'shapeName',  // Change to the name field in your custom ADM1 asset.
  villagesAsset: null,       // e.g. 'projects/ee-gee023/assets/Eswatini_Villages'
  villageField: 'Name',
  speciesAsset: null,        // Optional georeferenced, cleaned occurrence POINTS.
  speciesNameField: 'scientific_name',
  protectedAreasAsset: null,// Optional verified protected-area polygons.
  biiAsset: 'projects/ebx-data/assets/earthblox/IO/BII_V1_1',
  biiBand: null,            // null = first published BII band; specify if needed.
  biiLastYear: 2025,        // Published annual BII v1.1, 100 m, 2017–2025.
  ecosystemLastYear: 2024,  // CSIRO condition ends in 2024; fallback is labelled.
  trendThreshold: 0.005,
  urbanActivityScale: 30,
  urbanMinViews: 2,         // At least 2 confident views in BOTH 30-day windows.
  confidence: 0.55,
  chartScale: 120,
  maxPixels: 1000000000,
  crs: 'EPSG:32736'
};

var C = {
  navy: '#102A43', navy2: '#183B56', teal: '#087F8C', mint: '#2DD4BF',
  ink: '#243B53', muted: '#627D98', paper: '#FFFFFF', pale: '#F0F5F9',
  line: '#D9E2EC', amber: '#B45309', red: '#B91C1C'
};
var LC_NAMES = ['Water', 'Trees', 'Grass', 'Flooded vegetation', 'Crops',
  'Shrub & scrub', 'Built-up', 'Bare ground', 'Snow & ice'];
var LC_COLORS = ['419BDF', '397D49', '88B053', '7A87C6', 'E49635',
  'DFC35A', 'C4281B', 'A59B8F', 'B39FE1'];
var DW_BANDS = ['water', 'trees', 'grass', 'flooded_vegetation', 'crops',
  'shrub_and_scrub', 'built', 'bare', 'snow_and_ice'];
var DIVERGE = ['9F1239', 'FB7185', 'FFF7ED', '6EE7B7', '047857'];
var GREEN = ['F1F5F9', 'D9F0A3', '78C679', '238443', '005A32'];
var HEAT = ['FFF7BC', 'FEC44F', 'FE9929', 'EC7014', 'CC4C02', '8C2D04'];
var utcNow = new Date();
var lastYear = utcNow.getUTCFullYear() - 1;
var MODULES = [
  {name: 'Land classification', tag: '01', items: ['Land cover', 'Cover change'],
    about: 'Map land cover and compare two periods. Classification confidence is screened.'},
  {name: 'Biodiversity', tag: '02',
    items: ['Biodiversity Intactness Index (BII)', 'Ecosystem condition', 'Habitat extent and loss',
      'Habitat fragmentation', 'Canopy height'],
    about: 'Biodiversity models, habitat change and vegetation structure, with source dates shown.'},
  {name: 'Air quality', tag: '03',
    items: ['Carbon monoxide', 'Nitrogen dioxide (NO₂)', 'Absorbing aerosol index'],
    about: 'Regional atmospheric pollution indicators; these are not ground-level AQI measurements.'},
  {name: 'Water quality', tag: '04',
    items: ['Turbidity colour proxy', 'Chlorophyll proxy', 'Water extent'],
    about: 'Screen visible surface water. Spectral indices require field calibration.'},
  {name: 'Urban growth', tag: '05',
    items: ['Built-up cover', 'Built-up expansion', 'Built-up probability', '30-day activity'],
    about: 'Compare consistent Dynamic World classifications to screen settlement expansion.'},
  {name: 'Active fires', tag: '06',
    items: ['Recent thermal detections', 'Peak fire radiative power', 'Latest detection age', '30-day activity'],
    about: 'Recent VIIRS thermal detections. A hotspot is not a fire perimeter or a confirmed incident.'},
  {name: 'Land degradation', tag: '07',
    items: ['Land productivity', 'Land-cover degradation', 'Persistent bare ground',
      'Erosion susceptibility', 'Soil organic carbon', 'Restoration & recovery'],
    about: 'Screen productivity change and surface exposure; validate causes before classifying degradation.'}
];
// Preserve internal builder IDs; change presentation order without misrouting
// calculations, year controls, activity summaries or result metadata.
// Water quality is retained internally but excluded from the requested layout.
var NAV_ORDER = [0, 1, 6, 2, 4, 5];
NAV_ORDER.forEach(function(moduleId, position) {
  MODULES[moduleId].tag = ('0' + (position + 1)).slice(-2);
});

var publicRegions = ee.FeatureCollection('WM/geoLab/geoBoundaries/600/ADM1')
  .filter(ee.Filter.eq('shapeGroup', 'SWZ'));
var regions = CONFIG.boundaryAsset ? ee.FeatureCollection(CONFIG.boundaryAsset) : publicRegions;
var regionField = CONFIG.boundaryAsset ? CONFIG.regionField : 'shapeName';
var country = regions.geometry(100);
var state = {module: 0, region: country, areaName: 'Eswatini', token: 0,
  current: null, table: null, inspection: 0};
var cache = {};
var admin2Collection = null, admin2LoadToken = 0;

// ---------------------------------------------------------------------------
// INTERFACE
// ---------------------------------------------------------------------------
ui.root.clear();
var map = ui.Map();
map.setOptions('HYBRID');
map.setControlVisibility({all: false, zoomControl: true, mapTypeControl: true,
  scaleControl: true, layerList: true, fullscreenControl: true});
map.style().set('cursor', 'crosshair');
map.centerObject(country, 8);
var sidebar = ui.Panel({style: {width: '350px', backgroundColor: C.pale, padding: '0px'}});
ui.root.add(ui.SplitPanel({firstPanel: sidebar, secondPanel: map,
  orientation: 'horizontal', wipe: false, style: {stretch: 'both'}}));

function label(text, style) {
  var appearance = {fontSize: '12px', color: C.ink, margin: '4px 0', backgroundColor: '00000000'};
  Object.keys(style || {}).forEach(function(key) { appearance[key] = style[key]; });
  return ui.Label(text, appearance);
}
function heading(text) {
  return label(text, {fontSize: '11px', fontWeight: 'bold', color: C.teal, margin: '14px 0 6px 0'});
}
function note(text) {
  return label(text, {fontSize: '11px', color: C.muted, whiteSpace: 'normal', margin: '6px 0'});
}
function row(widgets) { return ui.Panel(widgets, ui.Panel.Layout.flow('horizontal')); }
function button(text, fn, primary) {
  return ui.Button({label: text, onClick: fn, style: {stretch: 'horizontal',
    margin: '4px 0', padding: '7px', fontSize: '12px', fontWeight: 'bold',
    border: '1px solid ' + (primary ? C.teal : C.line),
    color: primary ? C.paper : C.teal, backgroundColor: primary ? C.teal : C.paper}});
}
var brand = ui.Panel({style: {backgroundColor: C.navy, padding: '24px 18px', border: '0px solid ' + C.navy}});
brand.add(label('ESWATINI', {fontSize: '17px', fontWeight: 'bold', color: C.teal, margin: '0 0 4px'}));
brand.add(label('ENVI-INTELLIGENCE', {fontSize: '23px', fontWeight: 'bold', color: C.teal, margin: '0'}));
brand.add(label('Environmental evidence. Informed decisions.',
  {fontSize: '12px', color: '#BCCCDC', margin: '12px 0 0', whiteSpace: 'normal'}));
sidebar.add(brand);
var controls = ui.Panel({style: {padding: '12px 16px', backgroundColor: C.pale}});
sidebar.add(controls);
controls.add(heading('LOCATION'));
var areaSelect = ui.Select({items: ['Eswatini'], value: 'Eswatini',
  style: {stretch: 'horizontal'}, onChange: selectRegion});
controls.add(areaSelect);
controls.add(label('Admin2 • local analysis area'));
var admin2Select = ui.Select({items: [], placeholder: 'Loading Eswatini Admin2 areas…',
  disabled: true, style: {stretch: 'horizontal'}, onChange: selectAdmin2});
controls.add(admin2Select);
var admin2Status = note('Loading public global Admin2 boundaries for Eswatini.');
controls.add(admin2Status);
var villageSelect = ui.Select({items: [], placeholder: 'Select village',
  style: {stretch: 'horizontal', shown: !!CONFIG.villagesAsset}, onChange: selectVillage});
controls.add(villageSelect);
var areaCaption = note('Analysing: Eswatini');
controls.add(areaCaption);
var draw = map.drawingTools();
draw.setLinked(false);
draw.setShown(false);
draw.setDrawModes(['polygon']);
controls.add(row([
  button('Draw polygon', startDraw, false),
  button('Use drawn area', useDrawn, false)
]));
controls.add(row([
  button('Home', home, false),
  button('Clear results', clearResults, false)
]));
controls.add(heading('COMPARISON PERIOD'));
var years = [];
for (var y = 2019; y <= lastYear; y++) years.push(String(y));
var yearSelect = ui.Select({items: years, value: String(lastYear), style: {stretch: 'horizontal'},
  onChange: invalidate});
var baseSelect = ui.Select({items: years, value: '2019', style: {stretch: 'horizontal'},
  onChange: invalidate});
controls.add(label('Analysis year'));
controls.add(yearSelect);
controls.add(label('Baseline year'));
controls.add(baseSelect);
var seasonSelect = ui.Select({items: ['Full year', 'Wet months (Nov–Mar)', 'Dry months (Apr–Oct)'],
  value: 'Full year', style: {stretch: 'horizontal'}, onChange: invalidate});
controls.add(seasonSelect);
controls.add(note('Wet months use Jan–Mar and Nov–Dec of each selected calendar year.'));
var scaleSelect = ui.Select({items: ['10', '30', '60', '100'], value: '60',
  style: {stretch: 'horizontal'}, onChange: invalidate});
controls.add(label('Statistics sampling scale (metres)'));
controls.add(scaleSelect);
controls.add(note('60 m is faster nationwide. Use 10 m for small-area land-cover statistics.'));
controls.add(heading('ENVIRONMENTAL MODULES'));
var nav = ui.Panel({style: {backgroundColor: C.pale}});
controls.add(nav);
var navButtons = [];
NAV_ORDER.forEach(function(i) {
  var m = MODULES[i];
  var b = button(m.tag + '   ' + m.name, function() { switchModule(i); }, false);
  navButtons[i] = b; nav.add(b);
});
var about = note('');
controls.add(about);
var layerSelect = ui.Select({items: MODULES[0].items, value: MODULES[0].items[0],
  style: {stretch: 'horizontal', shown: false}, onChange: function() { invalidate(); analyse(); }});
// Internal select retains a single authoritative indicator; visible controls are subtabs.
var subtabPanel = ui.Panel({style: {backgroundColor: C.pale}});
controls.add(subtabPanel);
var soilOptions = ui.Panel({style: {shown: false, backgroundColor: C.pale}});
var soilDepth = ui.Select({items: ['0', '10', '30', '60', '100', '200'], value: '10',
  style: {stretch: 'horizontal'}, onChange: function() { invalidate(); analyse(); }});
soilOptions.add(label('Soil carbon sampling depth (cm)')); soilOptions.add(soilDepth);
controls.add(soilOptions);
var fireOptions = ui.Panel({style: {shown: false, backgroundColor: C.pale}});
var fireDays = ui.Select({items: ['1', '2', '7', '30'], value: '30',
  style: {stretch: 'horizontal'}, onChange: function() { invalidate(); analyse(); }});
var fireConfidence = ui.Select({items: ['Nominal + high', 'High only', 'All confidence levels'],
  value: 'Nominal + high', style: {stretch: 'horizontal'},
  onChange: function() { invalidate(); analyse(); }});
fireOptions.add(label('Recent fire window (days; UTC)'));
fireOptions.add(fireDays); fireOptions.add(label('Detection confidence')); fireOptions.add(fireConfidence);
controls.add(fireOptions);
var recoveryAsset = null;
var recoveryOptions = ui.Panel({style: {shown: false, backgroundColor: C.pale}});
var recoveryAssetInput = ui.Textbox({placeholder: 'projects/YOUR_PROJECT/assets/recovery_2019_2025',
  style: {stretch: 'horizontal'}});
recoveryOptions.add(heading('RECOVERY BATCH PROCESSING'));
recoveryOptions.add(note('Enter a new writable image asset ID. Create the export, run it in Tasks, then load the completed asset.'));
recoveryOptions.add(recoveryAssetInput);
recoveryOptions.add(button('Create recovery asset export', exportRecoveryAsset, true));
recoveryOptions.add(button('Load completed recovery asset', loadRecoveryAsset, false));
controls.add(recoveryOptions);
controls.add(button('ANALYSE AREA', analyse, true));
var status = note('Ready. Select an indicator and analyse your area.');
controls.add(status);
controls.add(note('Sources: geoBoundaries • Google Dynamic World • Copernicus • NASA • CHIRPS.'));
controls.add(note('V2.7 | Thembinkosi Samuel Simelane'));

// The floating map banner was removed; map context belongs in the sidebar.
var results = ui.Panel({style: {position: 'top-right', width: '385px', height: '590px',
  padding: '14px', backgroundColor: C.paper}});
var resultBody = ui.Panel();
results.add(row([label('AREA INSIGHTS', {color: C.teal, fontWeight: 'bold', margin: '4px 0', stretch: 'horizontal'}),
  ui.Button({label: 'Hide', onClick: function() { results.style().set('shown', false); },
    style: {fontSize: '10px', margin: '0'}})]));
results.add(resultBody); map.add(results);
controls.add(button('Show area insights', function() { results.style().set('shown', true); }, false));
var legend = ui.Panel({style: {position: 'bottom-left', padding: '10px 12px',
  width: '250px', backgroundColor: C.paper, shown: false}});
map.add(legend);
var inspector = ui.Panel({style: {position: 'bottom-right', padding: '8px 12px',
  width: '300px', backgroundColor: C.paper}});
var inspectLabel = note('Click the map to inspect the displayed indicator.');
inspector.add(inspectLabel); map.add(inspector);

// ---------------------------------------------------------------------------
// GENERAL DATA HELPERS
// ---------------------------------------------------------------------------
function masked(bands, scale) {
  var values = bands.map(function() { return 0; });
  return ee.Image.constant(values).rename(bands).toDouble().updateMask(ee.Image.constant(0))
    .setDefaultProjection(CONFIG.crs, null, scale || 20);
}
function safeComposite(collection, bands, method, scale) {
  // Cast real and fallback bands to double before merging. Double also preserves
  // acquisition epoch seconds without float rounding. The masked seed adds no values.
  var normalized = collection.select(bands).map(function(im) {
    return im.toDouble().copyProperties(im, ['system:time_start']);
  });
  var seeded = normalized.merge(ee.ImageCollection.fromImages([masked(bands, scale)]));
  var image = method === 'max' ? seeded.max() : method === 'median' ? seeded.median() : seeded.mean();
  return image.rename(bands).setDefaultProjection(CONFIG.crs, null, scale || 20);
}
function seasonal(collection, year, season) {
  var filtered = collection.filterDate(ee.Date.fromYMD(year, 1, 1), ee.Date.fromYMD(year + 1, 1, 1));
  if (season === 'Wet months (Nov–Mar)') {
    return filtered.filter(ee.Filter.or(ee.Filter.calendarRange(1, 3, 'month'),
      ee.Filter.calendarRange(11, 12, 'month')));
  }
  if (season === 'Dry months (Apr–Oct)') return filtered.filter(ee.Filter.calendarRange(4, 10, 'month'));
  return filtered;
}
function sumArea(mask, region, scale) {
  var value = ee.Image.pixelArea().divide(10000).rename('ha').updateMask(mask)
    .reduceRegion({reducer: ee.Reducer.sum(), geometry: region, scale: scale,
      crs: CONFIG.crs, maxPixels: CONFIG.maxPixels, tileScale: 4}).get('ha');
  return ee.Number(ee.Algorithms.If(value, value, 0));
}
function average(image, region, scale) {
  return image.rename('value').reduceRegion({reducer: ee.Reducer.mean(), geometry: region,
    scale: scale, crs: CONFIG.crs, maxPixels: CONFIG.maxPixels, tileScale: 4}).get('value');
}
function nd(image, a, b, name) {
  // Explicit ratio avoids normalizedDifference masking negative SR values.
  var aa = image.select(a), bb = image.select(b), denominator = aa.add(bb);
  return aa.subtract(bb).divide(denominator).updateMask(denominator.abs().gt(0.000001)).rename(name);
}
function dwFor(year, season) {
  var key = 'dw-' + year + '-' + season;
  if (cache[key]) return cache[key];
  var col = seasonal(ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(country), year, season);
  var probabilities = safeComposite(col, DW_BANDS, 'mean', 10);
  var confidence = probabilities.reduce(ee.Reducer.max()).rename('confidence');
  var lc = probabilities.toArray().arrayArgmax().arrayGet([0]).rename('landcover').toByte()
    .updateMask(confidence.gte(CONFIG.confidence));
  cache[key] = {lc: lc, confidence: confidence, probability: probabilities, source: col};
  return cache[key];
}
function habitat(lc) {
  return lc.eq(1).or(lc.eq(2)).or(lc.eq(3)).or(lc.eq(5)).rename('habitat');
}
function s2Collection(year, season) {
  var key = 's2-' + year + '-' + season;
  if (cache[key]) return cache[key];
  var col = seasonal(ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(country)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80)), year, season).map(function(im) {
      var scl = im.select('SCL');
      var good = scl.eq(4).or(scl.eq(5)).or(scl.eq(6)).or(scl.eq(7));
      var reflectance = im.select(['B2', 'B3', 'B4', 'B5', 'B8', 'B11', 'B12'])
        .multiply(0.0001).updateMask(good);
      var ndvi = nd(reflectance, 'B8', 'B4', 'NDVI');
      var ndwi = nd(reflectance, 'B3', 'B8', 'NDWI');
      var mndwi = nd(reflectance, 'B3', 'B11', 'MNDWI');
      var water = mndwi.gt(0.1).and(ndwi.gt(0)).and(ndvi.lt(0.2)).rename('water');
      // Erode edges by 20 m to reduce shoreline mixing in colour/chlorophyll indices.
      var interior = water.unmask(0).focalMin({radius: 20, units: 'meters'}).eq(1);
      var ndti = nd(reflectance, 'B4', 'B3', 'NDTI').updateMask(interior);
      var ndci = nd(reflectance, 'B5', 'B4', 'NDCI').updateMask(interior);
      return reflectance.addBands([ndvi, ndwi, mndwi, water.toFloat(), ndti, ndci])
        .copyProperties(im, ['system:time_start']);
    });
  cache[key] = col; return col;
}
var AIR = {
  'Nitrogen dioxide (NO₂)': {id: 'COPERNICUS/S5P/OFFL/L3_NO2', band: 'tropospheric_NO2_column_number_density',
    units: 'µmol/m²', factor: 1000000, min: 0, max: 150},
  'Carbon monoxide': {id: 'COPERNICUS/S5P/OFFL/L3_CO', band: 'CO_column_number_density',
    units: 'mmol/m²', factor: 1000, min: 15, max: 50},
  'Absorbing aerosol index': {id: 'COPERNICUS/S5P/OFFL/L3_AER_AI', band: 'absorbing_aerosol_index',
    units: 'index', factor: 1, min: -1, max: 3}
};
function airCollection(year, season, info) {
  return seasonal(ee.ImageCollection(info.id).filterBounds(country), year, season).map(function(im) {
    var v = im.select(info.band);
    if (info.factor !== 1) v = v.updateMask(v.gte(-0.001));
    return v.multiply(info.factor).rename('value').copyProperties(im, ['system:time_start']);
  });
}
function modisFor(year) {
  return ee.ImageCollection('MODIS/061/MOD13Q1').filterBounds(country)
    .filterDate(ee.Date.fromYMD(year, 1, 1), ee.Date.fromYMD(year + 1, 1, 1))
    .map(function(im) { return im.select('NDVI').multiply(0.0001)
      .updateMask(im.select('SummaryQA').lte(1)).rename('NDVI')
      .copyProperties(im, ['system:time_start']); });
}

// ---------------------------------------------------------------------------
// RESULTS / CHART HELPERS
// ---------------------------------------------------------------------------
function fmt(v, decimals) {
  if (v === null || v === undefined || typeof v !== 'number' || !isFinite(v)) return 'No data';
  return v.toLocaleString('en-US', {minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0});
}
function metric(title, value, unit) {
  var card = ui.Panel({style: {backgroundColor: C.pale, padding: '9px 12px', margin: '5px 0'}});
  card.add(label(title, {fontSize: '10px', color: C.muted, margin: '0'}));
  card.add(label(value + (unit ? '  ' + unit : ''),
    {fontSize: '20px', fontWeight: 'bold', color: C.navy, margin: '3px 0 0'}));
  resultBody.add(card);
}
function chartOptions(title, axis, color) {
  return {title: title, titleTextStyle: {fontSize: 12, color: C.ink},
    backgroundColor: 'FFFFFF', colors: [color || C.teal], legend: {position: 'none'},
    height: 210, chartArea: {left: 58, right: 15, top: 38, bottom: 42},
    hAxis: {title: 'Month', format: 'MMM', textStyle: {fontSize: 10}},
    vAxis: {title: axis, textStyle: {fontSize: 10}}, lineWidth: 2, pointSize: 4,
    interpolateNulls: false};
}
function monthlyFeatures(collection, band, year, region, scale) {
  return ee.FeatureCollection(ee.List.sequence(1, 12).map(function(month) {
    var start = ee.Date.fromYMD(year, month, 1);
    var c = collection.filterDate(start, start.advance(1, 'month'));
    var mean = safeComposite(c, [band], 'mean', scale);
    return ee.Feature(null, {date: start.millis(), month: month,
      value: average(mean, region, scale), source_count: c.size()});
  }));
}
function addMonthly(collection, band, p, unit, title, token, scale) {
  var features = monthlyFeatures(collection, band, p.year, p.region, scale || Math.max(p.scale, CONFIG.chartScale));
  addFeatureChart(features, 'date', ['value'], chartOptions(title + ' • ' + p.year, unit), token);
}
function addFeatureChart(features, x, ys, options, token, chartType) {
  var holder = ui.Panel(); resultBody.add(holder);
  features.evaluate(function(data, error) {
    if (token !== state.token) return;
    if (error) { holder.add(note('Chart unavailable: ' + error)); return; }
    var rows = data && data.features || [];
    var hasData = rows.some(function(f) { return ys.some(function(k) {
      return f.properties[k] !== null && f.properties[k] !== undefined;
    }); });
    if (!hasData) { holder.add(note('No valid observations for this chart.')); return; }
    // Build from already evaluated rows: true Date values for calendar axes,
    // preserved nulls for chart gaps, and no second server request for the chart.
    var cols = [{id: x, label: x === 'date' ? 'Date' : x === 'height_m' ? 'Height (m)' : 'Year', type: x === 'date' ? 'date' : 'number'}];
    ys.forEach(function(k) { cols.push({id: k, label: k === 'value' ? options.vAxis.title : k, type: 'number'}); });
    var chartRows = rows.map(function(f) {
      var props = f.properties;
      var cells = [{v: x === 'date' ? new Date(props[x]) : props[x]}];
      ys.forEach(function(k) { cells.push({v: typeof props[k] === 'number' ? props[k] : null}); });
      return {c: cells};
    });
    var chart = ui.Chart({dataTable: {cols: cols, rows: chartRows}, chartType: chartType || 'LineChart', options: options});
    holder.add(chart);
  });
}
function makeLegend(d) {
  legend.clear(); legend.style().set('shown', true);
  legend.add(label(d.title, {fontSize: '11px', fontWeight: 'bold', color: C.ink, margin: '0 0 6px', whiteSpace: 'normal'}));
  if (d.categories) {
    d.categories.forEach(function(cat) {
      legend.add(row([label('', {backgroundColor: '#' + cat.color, padding: '7px', margin: '2px 7px 2px 0'}),
        label(cat.name, {fontSize: '10px', margin: '2px 0', color: C.ink})]));
    });
  } else {
    var palette = d.vis.palette;
    var blocks = palette.map(function(color) {
      return label('', {backgroundColor: '#' + color, padding: '7px', margin: '0', stretch: 'horizontal'});
    });
    legend.add(row(blocks));
    legend.add(row([label(String(d.vis.min), {fontSize: '10px', stretch: 'horizontal', margin: '3px 0'}),
      label(String(d.vis.max) + ' ' + d.units, {fontSize: '10px', margin: '3px 0'})]));
  }
  legend.add(note('Blank pixels: masked / outside indicator coverage.'));
}
function baseLayers() {
  map.layers().reset([]);
  map.addLayer(regions.style({color: '94A3B8', fillColor: '00000000', width: 1}), {}, 'Region outlines', true);
  if (admin2Collection) map.addLayer(admin2Collection.style({color: 'CBD5E1', fillColor: '00000000', width: 1}), {}, 'Global Admin2 boundaries', false);
}
function outline() {
  map.addLayer(ee.FeatureCollection([ee.Feature(state.region)]).style({color: '2DD4BF',
    fillColor: '00000000', width: 2}), {}, 'Analysis area outline', true);
}
function params() {
  return {year: Number(yearSelect.getValue()), baseline: Number(baseSelect.getValue()),
    season: seasonSelect.getValue(), region: state.region, areaName: state.areaName,
    scale: Number(scaleSelect.getValue()), indicator: layerSelect.getValue(), module: state.module};
}
function descriptor(image, title, units, vis, source, sourceCollection, categories, scale) {
  return {image: image.rename('value'), title: title, units: units, vis: vis,
    source: source, collection: sourceCollection, categories: categories, scale: scale || 20,
    stats: {}, cards: [], notes: [], charts: null};
}

// ---------------------------------------------------------------------------
// SEVEN MODULES
// ---------------------------------------------------------------------------
function landModule(p) {
  var cur = dwFor(p.year, p.season), old = dwFor(p.baseline, p.season);
  var change = p.indicator === 'Cover change';
  var common = cur.lc.mask().and(old.lc.mask());
  var image = change ? cur.lc.neq(old.lc).rename('change') : cur.lc;
  var d = descriptor(image, p.indicator, change ? '0/1' : 'class code',
    change ? {min: 0, max: 1, palette: ['CBD5E1', 'F97316']} : {min: 0, max: 8, palette: LC_COLORS},
    'Dynamic World mean probabilities • 10 m • confidence ≥ ' + CONFIG.confidence,
    cur.source, change ? [{name: 'Stable class', color: 'CBD5E1'}, {name: 'Changed class', color: 'F97316'}]
      : LC_NAMES.map(function(n, i) { return {name: n, color: LC_COLORS[i]}; }), 10);
  d.stats.valid_ha = sumArea(change ? common : cur.lc.mask(), p.region, p.scale);
  d.stats.changed_ha = sumArea(cur.lc.neq(old.lc), p.region, p.scale);
  LC_NAMES.forEach(function(n, i) { d.stats['class_' + i] = sumArea(cur.lc.eq(i), p.region, p.scale); });
  d.cards = [{key: 'valid_ha', title: 'Valid classified area', unit: 'ha'},
    {key: 'changed_ha', title: 'Class change on jointly observed pixels', unit: 'ha'}];
  d.notes.push('Class change is a screening result. Seasonal variability and classification errors can resemble conversion.');
  d.charts = function(token) {
    var features = ee.FeatureCollection(LC_NAMES.map(function(n, i) {
      return ee.Feature(null, {class_name: n, hectares: d.stats['class_' + i]});
    }));
    if (token !== state.token) return;
    resultBody.add(ui.Chart.feature.byFeature(features, 'class_name', ['hectares']).setChartType('BarChart')
      .setOptions({title: 'Land cover • ' + p.year, colors: [C.teal], legend: {position: 'none'},
        height: 280, chartArea: {left: 115, right: 15, top: 35, bottom: 30},
        hAxis: {title: 'Hectares'}, vAxis: {textStyle: {fontSize: 10}}}));
    // Long-format observed transitions retained in the analysis table.
    var pairs = old.lc.multiply(10).add(cur.lc).rename('pair');
    var grouped = ee.Image.pixelArea().divide(10000).rename('ha').addBands(pairs)
      .reduceRegion({reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'pair'}),
        geometry: p.region, scale: p.scale, crs: CONFIG.crs, maxPixels: CONFIG.maxPixels, tileScale: 4});
    var groups = ee.List(ee.Dictionary(grouped).get('groups', ee.List([])));
    var transitions = ee.FeatureCollection(groups.map(function(g) {
      g = ee.Dictionary(g); var pair = ee.Number(g.get('pair'));
      var from = pair.divide(10).floor(), to = pair.mod(10);
      return ee.Feature(null, {record_type: 'land_cover_transition',
        from_class: ee.List(LC_NAMES).get(from), to_class: ee.List(LC_NAMES).get(to),
        value: g.get('sum'), unit: 'ha', area: p.areaName, baseline: p.baseline,
        analysis_year: p.year, season: p.season, sampling_scale_m: p.scale});
    }));
    state.table = state.table.merge(transitions);
  };
  return d;
}
function annualModelChart(collection, band, p, startYear, endYear, scale, title, unit, token) {
  var features = ee.FeatureCollection(ee.List.sequence(startYear, endYear).map(function(yy) {
    yy = ee.Number(yy);
    var col = collection.filterDate(ee.Date.fromYMD(yy, 1, 1), ee.Date.fromYMD(yy.add(1), 1, 1));
    return ee.Feature(null, {year: yy, value: average(safeComposite(col, [band], 'mean', scale), p.region, scale)});
  }));
  var opts = chartOptions(title, unit); opts.hAxis = {title: 'Year', format: '####'};
  addFeatureChart(features, 'year', ['value'], opts, token);
}
function biodiversityModule(p) {
  var d;
  if (p.indicator === 'Biodiversity Intactness Index (BII)') {
    var usedYear = Math.min(p.year, CONFIG.biiLastYear);
    var baseYear = Math.min(p.baseline, CONFIG.biiLastYear);
    var all = ee.ImageCollection(CONFIG.biiAsset).filterBounds(country).map(function(im) {
      return im.select(CONFIG.biiBand ? [CONFIG.biiBand] : [0]).rename('BII').toFloat()
        .copyProperties(im, ['system:time_start']);
    });
    var col = seasonal(all, usedYear, 'Full year');
    var im = safeComposite(col, ['BII'], 'mean', 100);
    var old = safeComposite(seasonal(all, baseYear, 'Full year'), ['BII'], 'mean', 100);
    d = descriptor(im, p.indicator, 'index (0–1)', {min: 0, max: 1, palette: GREEN},
      'Impact Observatory / Vizzuality BII v1.1 • Earth Blox public asset • 100 m', col, null, 100);
    d.stats.mean_bii = average(im, p.region, 100);
    d.stats.baseline_bii = average(old, p.region, 100);
    d.cards = [{key: 'mean_bii', title: 'Mean modelled BII • ' + usedYear, unit: 'index', decimals: 3},
      {key: 'baseline_bii', title: 'Baseline modelled BII • ' + baseYear, unit: 'index', decimals: 3}];
    d.notes.push('BII estimates abundance and compositional similarity relative to an intact reference. It is not a species census or BHI.');
    d.notes.push('Annual data used: ' + baseYear + ' → ' + usedYear + '. Seasonal filters do not apply. Published coverage: 2017–2025.');
    if (usedYear !== p.year) d.notes.push('Requested year ' + p.year + ' is unavailable; displaying ' + usedYear + ' explicitly.');
    d.actualYear = usedYear;
    d.charts = function(token) { annualModelChart(all, 'BII', p, baseYear, usedYear, 100,
      'Annual Biodiversity Intactness Index', 'BII', token); };
  } else if (p.indicator === 'Ecosystem condition') {
    var conditionYear = Math.min(p.year, CONFIG.ecosystemLastYear);
    var condBase = Math.min(p.baseline, CONFIG.ecosystemLastYear);
    var allCondition = ee.ImageCollection('CSIRO/BHI/v4').filterBounds(country);
    var condCol = seasonal(allCondition, conditionYear, 'Full year');
    var condition = safeComposite(condCol, ['ecosystem_condition'], 'mean', 1000);
    var condOld = safeComposite(seasonal(allCondition, condBase, 'Full year'), ['ecosystem_condition'], 'mean', 1000);
    d = descriptor(condition, p.indicator, '%', {min: 0, max: 100, palette: GREEN},
      'CSIRO BILBI ecosystem_condition • approximately 1 km • annual model', condCol, null, 1000);
    d.stats.mean_condition = average(condition, p.region, 1000);
    d.stats.baseline_condition = average(condOld, p.region, 1000);
    d.cards = [{key: 'mean_condition', title: 'Mean ecosystem condition • ' + conditionYear, unit: '%', decimals: 1},
      {key: 'baseline_condition', title: 'Baseline condition • ' + condBase, unit: '%', decimals: 1}];
    d.actualYear = conditionYear;
    d.notes.push('Relative modelled ecosystem condition compared with a reference state. Small chiefdoms may contain few 1 km pixels.');
    d.notes.push('Annual data used: ' + condBase + ' → ' + conditionYear + '; seasonal filters do not apply. CSIRO licence: CC BY-NC-SA 4.0.');
    if (conditionYear !== p.year) d.notes.push('Requested year ' + p.year + ' is unavailable; displaying ' + conditionYear + ' explicitly.');
    d.charts = function(token) { annualModelChart(allCondition, 'ecosystem_condition', p,
      condBase, conditionYear, 1000, 'Annual ecosystem condition', '%', token); };
  } else if (p.indicator === 'Canopy height') {
    // User-supplied GEDI / Sentinel-2 RF workflow, with sparse-support sampling.
    // Fixed reference periods; this is a modelled 2022–2023 surface, not annual change.
    var trainingRegion = p.region.buffer(10000, 100).intersection(country, 100);
    var gedi = ee.ImageCollection('LARSE/GEDI/GEDI02_A_002_MONTHLY')
      .filterBounds(trainingRegion).filterDate('2019-01-01', '2024-01-01')
      .select(['rh98', 'quality_flag', 'degrade_flag', 'sensitivity']).map(function(im) {
        return im.select('rh98').updateMask(im.select('quality_flag').eq(1))
          .updateMask(im.select('degrade_flag').eq(0))
          .updateMask(im.select('sensitivity').gte(0.95))
          .updateMask(im.select('rh98').gte(0).and(im.select('rh98').lte(80)))
          .rename('canopy').toFloat().copyProperties(im, ['system:time_start']);
      });
    // Latest valid shot at overlaps avoids a multi-year median memory stack.
    var canopy = ee.ImageCollection.fromImages([masked(['canopy'], 25)])
      .merge(gedi.sort('system:time_start')).mosaic().rename('canopy')
      .setDefaultProjection(CONFIG.crs, null, 25).clip(trainingRegion);
    var s2col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(trainingRegion).filterDate('2022-01-01', '2024-01-01')
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .select(['B2', 'B3', 'B4', 'B8', 'SCL']).map(function(im) {
        var scl = im.select('SCL');
        return im.select(['B2', 'B3', 'B4', 'B8']).multiply(0.0001)
          .updateMask(scl.eq(4).or(scl.eq(5)).or(scl.eq(6)).or(scl.eq(7)))
          .copyProperties(im, ['system:time_start']);
      });
    var s2 = safeComposite(s2col, ['B2', 'B3', 'B4', 'B8'], 'median', 30);
    var ndvi = nd(s2, 'B8', 'B4', 'NDVI');
    var evi = s2.expression('2.5*((NIR-RED)/(NIR+6*RED-7.5*BLUE+1))', {
      NIR: s2.select('B8'), RED: s2.select('B4'), BLUE: s2.select('B2')}).rename('EVI');
    var dem = ee.Image('USGS/SRTMGL1_003');
    var predictors = s2.addBands(ndvi).addBands(evi).addBands(dem.rename('DEM'))
      .addBands(ee.Terrain.slope(dem).rename('slope'))
      .addBands(ee.Terrain.aspect(dem).rename('aspect')).toFloat();
    var names = ['B2', 'B3', 'B4', 'B8', 'NDVI', 'EVI', 'DEM', 'slope', 'aspect'];
    // Sample inside valid GEDI support, rather than 5,000 mostly empty ROI cells.
    var sampleClass = ee.Image.constant(1).rename('sample_class').toByte().updateMask(canopy.mask());
    var samples = predictors.addBands(canopy).addBands(sampleClass).stratifiedSample({
      numPoints: 5000, classBand: 'sample_class', region: trainingRegion,
      scale: 30, projection: CONFIG.crs, seed: 1, tileScale: 8,
      dropNulls: true, geometries: false}).randomColumn('split', 1);
    var training = samples.filter(ee.Filter.lt('split', 0.8));
    var validation = samples.filter(ee.Filter.gte('split', 0.8));
    var ready = training.size().gte(50);
    var model = ee.Classifier.smileRandomForest({numberOfTrees: 200,
      minLeafPopulation: 5, maxNodes: 64, seed: 1}).setOutputMode('REGRESSION')
      .train({features: training, classProperty: 'canopy', inputProperties: names});
    var prediction = ee.Image(ee.Algorithms.If(ready,
      predictors.select(names).classify(model).rename('canopy_height'),
      masked(['canopy_height'], 30))).max(0).setDefaultProjection(CONFIG.crs, null, 30);
    var clean = prediction.focalMean({radius: 40, units: 'meters'})
      .updateMask(prediction.mask()).clip(p.region).rename('canopy_height');
    d = descriptor(clean, 'Predicted canopy height • GEDI / RF', 'm',
      {min: 0, max: 60, palette: ['edf8fb', 'b2e2e2', '66c2a4', '2ca25f', '006d2c']},
      'GEDI 2019–2023 + Sentinel-2 2022–2023 + SRTM • 200-tree regression • 30 m', s2col, null, 30);
    d.actualYear = 2023;
    var stats = clean.reduceRegion({reducer: ee.Reducer.min().combine(ee.Reducer.max(), '', true)
      .combine(ee.Reducer.mean(), '', true).combine(ee.Reducer.stdDev(), '', true),
      geometry: p.region, scale: 30, crs: CONFIG.crs, maxPixels: CONFIG.maxPixels, tileScale: 8});
    ['min', 'max', 'mean', 'stdDev'].forEach(function(key) {
      d.stats['height_' + key] = stats.get('canopy_height_' + key);
    });
    d.stats.training_samples = training.size(); d.stats.validation_samples = validation.size();
    var tested = validation.classify(model, 'predicted').map(function(f) {
      return f.set('squared_error', ee.Number(f.get('predicted')).subtract(ee.Number(f.get('canopy'))).pow(2));
    });
    d.stats.validation_rmse = ee.Algorithms.If(ready.and(validation.size().gt(0)),
      ee.Number(tested.aggregate_mean('squared_error')).sqrt(), null);
    d.cards = [{key: 'height_mean', title: 'Mean predicted height', unit: 'm', decimals: 1},
      {key: 'height_min', title: 'Minimum predicted height', unit: 'm', decimals: 1},
      {key: 'height_max', title: 'Maximum predicted height', unit: 'm', decimals: 1},
      {key: 'height_stdDev', title: 'Height standard deviation', unit: 'm', decimals: 1},
      {key: 'training_samples', title: 'Training samples • minimum 50', unit: 'cells'},
      {key: 'validation_rmse', title: 'Random holdout RMSE', unit: 'm', decimals: 2}];
    var hist = ee.Dictionary(clean.reduceRegion({reducer: ee.Reducer.fixedHistogram(0, 100, 20),
      geometry: p.region, scale: 30, crs: CONFIG.crs, maxPixels: CONFIG.maxPixels, tileScale: 8}));
    var buckets = ee.Array(hist.get('canopy_height', ee.Array([[0, 0]]))).toList();
    d.distribution = ee.FeatureCollection(buckets.map(function(pair) {
      pair = ee.List(pair); var lower = ee.Number(pair.get(0));
      return ee.Feature(null, {height_m: lower.add(2.5), bin_lower_m: lower,
        bin_upper_m: lower.add(5), pixel_count: pair.get(1), reference_year: 2023});
    }));
    d.charts = function(token) { addFeatureChart(d.distribution, 'height_m', ['pixel_count'],
      chartOptions('Predicted canopy height distribution • 5 m bins', '30 m cell count'), token, 'ColumnChart'); };
    d.notes.push('Fixed reference periods: GEDI 2019–2023; Sentinel-2 2022–2023. Year, baseline and season selectors do not apply. Training includes a 10 km buffer within Eswatini; predictions are clipped to the selected area.');
    d.notes.push('Reflectance is scaled to 0–1 before EVI. Up to 5,000 valid GEDI-supported cells are split 80/20; fewer than 50 training cells produces no prediction.');
    d.notes.push('Latest valid GEDI shots replace the multi-year median to reduce memory use. Predictions are smoothed over 40 m on a 30 m grid. They are model estimates, not measured tree heights or a forest-only map.');
    d.notes.push('Random holdout RMSE is an internal diagnostic; nearby samples are correlated and independent spatial validation is still needed.');
  } else {
    var cur, h, oldHab, loss, gain;
    if (p.indicator === 'Habitat extent and loss') {
      cur = dwFor(p.year, p.season);
      var oldCover = dwFor(p.baseline, p.season);
      h = habitat(cur.lc); oldHab = habitat(oldCover.lc);
      loss = oldHab.and(h.not()); gain = oldHab.not().and(h);
      var change = h.toByte().where(loss, 2).where(gain, 3)
        .updateMask(cur.lc.mask().and(oldCover.lc.mask()));
      d = descriptor(change, p.indicator, 'class code', {min: 0, max: 3,
        palette: ['E2E8F0', '15803D', 'E11D48', '14B8A6']},
        'Dynamic World • potential habitat-cover transitions • 10 m', cur.source,
        [{name: 'Other cover', color: 'E2E8F0'}, {name: 'Retained habitat proxy', color: '15803D'},
          {name: 'Habitat proxy lost', color: 'E11D48'}, {name: 'Habitat proxy gained', color: '14B8A6'}], 10);
      d.stats.habitat_ha = sumArea(h, p.region, p.scale);
      d.stats.loss_ha = sumArea(loss, p.region, p.scale);
      d.stats.gain_ha = sumArea(gain, p.region, p.scale);
      d.cards = [{key: 'habitat_ha', title: 'Potential habitat cover', unit: 'ha'},
        {key: 'loss_ha', title: 'Habitat-cover proxy loss', unit: 'ha'},
        {key: 'gain_ha', title: 'Habitat-cover proxy gain', unit: 'ha'}];
    } else {
      // Sample each categorical observation on a 100 m grid BEFORE temporal
      // compositing; this avoids a nationwide 10 m nine-band array reduction.
      var fragmentCol = seasonal(ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
        .filterBounds(p.region.buffer(600, 100)), p.year, p.season).select('label').map(function(im) {
          return habitat(im.select('label')).rename('habitat').toFloat()
            .reproject({crs: CONFIG.crs, scale: 100})
            .clip(p.region.buffer(600, 100)).copyProperties(im, ['system:time_start']);
        });
      var grid = safeComposite(fragmentCol, ['habitat'], 'mean', 100)
        .reproject({crs: CONFIG.crs, scale: 100});
      var neighbourhood = grid.focalMean({radius: 500, units: 'meters'});
      var localHabitat = grid.gte(0.5);
      var fragmentation = ee.Image.constant(1).subtract(neighbourhood).multiply(100)
        .updateMask(localHabitat).updateMask(grid.mask()).rename('fragmentation');
      var core = localHabitat.focalMin({radius: 100, units: 'meters'}).eq(1).updateMask(grid.mask());
      d = descriptor(fragmentation, p.indicator, '% neighbourhood non-habitat',
        {min: 0, max: 100, palette: ['047857', '6EE7B7', 'FEF3C7', 'F97316', '9F1239']},
        'Dynamic World categorical samples • 500 m neighbourhood / 100 m grid', fragmentCol, null, 100);
      d.stats.fragmentation_mean = average(fragmentation, p.region, 100);
      d.stats.core_ha = sumArea(core, p.region, 100);
      d.cards = [{key: 'fragmentation_mean', title: 'Mean surrounding non-habitat exposure', unit: '%', decimals: 1},
        {key: 'core_ha', title: 'Core habitat proxy • ≥100 m from edge', unit: 'ha'}];
      d.notes.push('Memory-efficient screening uses nearest-neighbour 100 m samples of individual land-cover observations, then temporal habitat frequency; it does not calculate exact 10 m habitat fractions.');
      d.notes.push('Higher values mean more non-habitat within a 500 m neighbourhood. This is structural fragmentation, not species-specific functional connectivity.');
    }
    d.notes.push('Trees, grass, flooded vegetation and shrub/scrub are potential habitat classes. Plantations and managed land may be included; refine with local ecosystem maps.');
    d.charts = function(token) { addMonthly(s2Collection(p.year, 'Full year'), 'NDVI', p,
      'NDVI', 'Vegetation context • not species diversity', token); };
  }
  if (CONFIG.speciesAsset) {
    var points = ee.FeatureCollection(CONFIG.speciesAsset).filterBounds(p.region)
      .filter(ee.Filter.notNull([CONFIG.speciesNameField]));
    d.stats.recorded_species = points.aggregate_count_distinct(CONFIG.speciesNameField);
    d.cards.push({key: 'recorded_species', title: 'Recorded species • all supplied dates', unit: 'taxa'});
    d.overlay = points.style({color: 'A855F7', pointSize: 3});
    d.notes.push('Recorded species are sampling-dependent, not a complete inventory.');
  }
  return d;
}
function airModule(p) {
  var info = AIR[p.indicator], col = airCollection(p.year, p.season, info);
  var oldCol = airCollection(p.baseline, p.season, info);
  var im = safeComposite(col, ['value'], 'mean', 1113.2);
  var old = safeComposite(oldCol, ['value'], 'mean', 1113.2);
  var d = descriptor(im, p.indicator, info.units,
    {min: info.min, max: info.max, palette: HEAT}, 'Sentinel-5P OFFL • regional atmospheric indicator', col, null, 1113.2);
  d.stats.mean = average(im, p.region, 1113.2);
  d.stats.baseline_mean = average(old, p.region, 1113.2);
  d.cards = [{key: 'mean', title: 'Analysis-period spatial mean', unit: info.units, decimals: 2},
    {key: 'baseline_mean', title: 'Baseline-period spatial mean', unit: info.units, decimals: 2}];
  d.notes.push('The ~1.1 km catalogue grid is a regridding scale. Native TROPOMI footprints are several kilometres; street-scale interpretation is unsuitable.');
  d.notes.push('Columns are not breathing-height concentrations or AQI. Small negative retrievals are retained; palette bounds are visual bounds, not health thresholds.');
  if (p.indicator === 'Nitrogen dioxide (NO₂)') d.notes.push('NO₂ is the nitrogen oxide measured here; this is not total NOx or nitric oxide (NO).');
  d.charts = function(token) { addMonthly(airCollection(p.year, 'Full year', info), 'value', p,
    info.units, 'Monthly ' + p.indicator.toLowerCase(), token, 1113.2); };
  return d;
}
function waterModule(p) {
  var col = s2Collection(p.year, p.season);
  var waterFraction = safeComposite(col, ['water'], 'mean', 20);
  var isWater = waterFraction.gte(0.5);
  var isExtent = p.indicator === 'Water extent';
  var band = p.indicator === 'Chlorophyll proxy' ? 'NDCI' : 'NDTI';
  var image = isExtent ? isWater.selfMask() : safeComposite(col, [band], 'median', 20).updateMask(isWater);
  var d = descriptor(image, p.indicator, isExtent ? '0/1' : band,
    isExtent ? {min: 0, max: 1, palette: ['FFFFFF', '0284C7']} :
      {min: -0.4, max: 0.4, palette: p.indicator === 'Chlorophyll proxy' ?
        ['EFF6FF', '93C5FD', '34D399', '15803D'] : ['1D4ED8', '93C5FD', 'FEF3C7', 'D97706', '78350F']},
    'Sentinel-2 • cloud-screened water spectra • 20 m analysis', col,
    isExtent ? [{name: 'Water in ≥50% of valid observations', color: '0284C7'}] : null, 20);
  d.stats.water_ha = sumArea(isWater, p.region, p.scale);
  d.stats.mean = average(image, p.region, Math.max(p.scale, 20));
  d.cards = [{key: 'water_ha', title: 'Frequently observed water surface', unit: 'ha'}];
  if (!isExtent) d.cards.push({key: 'mean', title: 'Mean spectral proxy', unit: band, decimals: 3});
  d.notes.push('Water mask: MNDWI > 0.1, NDWI > 0, NDVI < 0.2; classified as water in ≥50% of valid views. This can omit shallow/turbid water.');
  d.notes.push('NDTI = (red − green)/(red + green). NDCI = (red-edge − red)/(red-edge + red). Neither has a universal concentration conversion.');
  d.notes.push('Water-colour indices exclude a 20 m shoreline margin. Narrow rivers may have no valid interior pixels. Local sampling and aquatic atmospheric correction are needed for quantitative use.');
  d.charts = function(token) { addMonthly(s2Collection(p.year, 'Full year'), isExtent ? 'water' : band,
    p, isExtent ? 'Observed water fraction' : band, 'Monthly water indicator', token, Math.max(p.scale, 20)); };
  return d;
}
function rasterCellCount(image, region, scale) {
  return image.rename('cell').reduceRegion({reducer: ee.Reducer.count(), geometry: region,
    scale: scale, crs: CONFIG.crs, maxPixels: CONFIG.maxPixels, tileScale: 4}).get('cell');
}
function urbanActivity(p) {
  var now = ee.Date(utcNow.toISOString()), since = now.advance(-30, 'day');
  var all = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(country)
    .filterDate(now.advance(-60, 'day'), now).map(function(im) {
      var conf = im.select(DW_BANDS).reduce(ee.Reducer.max());
      return im.select('built').updateMask(conf.gte(CONFIG.confidence))
        .copyProperties(im, ['system:time_start']);
    });
  var cur = all.filterDate(since, now), old = all.filterDate(now.advance(-60, 'day'), since);
  var cp = safeComposite(cur, ['built'], 'mean', 10), bp = safeComposite(old, ['built'], 'mean', 10);
  var seed = ee.ImageCollection.fromImages([masked(['built'], 10)]);
  var cv = cur.merge(seed).count(), bv = old.merge(seed).count();
  var supported = cv.gte(CONFIG.urbanMinViews).and(bv.gte(CONFIG.urbanMinViews))
    .and(cp.mask()).and(bp.mask());
  var changed = cp.gte(0.65).and(bp.lte(0.45)).and(cp.subtract(bp).gte(0.20))
    .updateMask(supported).rename('activity');
  var support = sumArea(supported, p.region, CONFIG.urbanActivityScale);
  var count = rasterCellCount(changed.selfMask(), p.region, CONFIG.urbanActivityScale);
  return {changed: changed, cells: ee.Algorithms.If(support.gt(0), count, null),
    hectares: ee.Algorithms.If(support.gt(0), sumArea(changed, p.region, CONFIG.urbanActivityScale), null),
    support: support, latest: cur.aggregate_max('system:time_start'), collection: cur};
}
function fireCollection(days) {
  var now = ee.Date(utcNow.toISOString()), since = now.advance(-days, 'day');
  var all = ee.ImageCollection('NASA/LANCE/SNPP_VIIRS/C2')
    .merge(ee.ImageCollection('NASA/LANCE/NOAA20_VIIRS/C2')).filterBounds(country)
    .filterDate(since.advance(-1, 'day'), now.advance(1, 'day'));
  var threshold = fireConfidence.getValue() === 'High only' ? 2 :
    fireConfidence.getValue() === 'All confidence levels' ? 0 : 1;
  var col = all.map(function(im) {
    var mask = im.select('confidence').gte(threshold)
      .and(im.select('acq_epoch').gte(since.millis().divide(1000)))
      .and(im.select('acq_epoch').lte(now.millis().divide(1000)));
    return im.select(['frp', 'acq_epoch', 'confidence']).updateMask(mask)
      .copyProperties(im, ['system:time_start']);
  });
  return {all: all, filtered: col, since: since, now: now};
}
function fireActivity(p) {
  var data = fireCollection(30), since = data.since;
  var daily = ee.ImageCollection.fromImages(ee.List.sequence(0, 29).map(function(k) {
    var start = since.advance(k, 'day'), finish = start.advance(1, 'day');
    var c = data.filtered.map(function(im) {
      return im.updateMask(im.select('acq_epoch').gte(start.millis().divide(1000))
        .and(im.select('acq_epoch').lt(finish.millis().divide(1000))));
    });
    var maximum = safeComposite(c, ['acq_epoch'], 'max', 375);
    var detected = maximum.multiply(0).add(1).rename('detection_day');
    // Each 375 m grid cell contributes at most once per bucket across both satellites.
    return detected.set('system:time_start', start.millis());
  }));
  var frequency = daily.sum().rename('detection_days').setDefaultProjection(CONFIG.crs, null, 375);
  var count = frequency.reduceRegion({reducer: ee.Reducer.sum(), geometry: p.region,
    scale: 375, crs: CONFIG.crs, maxPixels: CONFIG.maxPixels, tileScale: 4}).get('detection_days');
  return {data: data, daily: daily, frequency: frequency,
    count: ee.Algorithms.If(data.all.size().gt(0), ee.Algorithms.If(count, count, 0), null)};
}
function urbanModule(p) {
  var cur = dwFor(p.year, p.season), old = dwFor(p.baseline, p.season);
  var common = cur.lc.mask().and(old.lc.mask());
  var currentBuilt = cur.lc.eq(6), oldBuilt = old.lc.eq(6);
  var newBuilt = currentBuilt.and(oldBuilt.not());
  var lostBuilt = oldBuilt.and(currentBuilt.not());
  var recent = urbanActivity(p);
  var activity = p.indicator === '30-day activity';
  var probability = p.indicator === 'Built-up probability';
  var expansion = p.indicator === 'Built-up expansion';
  var image = activity ? recent.changed.selfMask() : probability ? cur.probability.select('built') : expansion ? newBuilt.selfMask() : currentBuilt.selfMask();
  var d = descriptor(image, p.indicator, probability ? 'probability' : '0/1',
    {min: 0, max: 1, palette: ['F1F5F9', 'FBBF24', 'F97316', '9A3412']},
    'Dynamic World • built-up class/probability • 10 m', cur.source,
    probability ? null : [{name: activity ? 'Potential recent built-up change' : expansion ? 'Newly classified built-up' : 'Classified built-up', color: '9A3412'}], activity ? CONFIG.urbanActivityScale : 10);
  d.stats.current_built_ha = sumArea(currentBuilt, p.region, p.scale);
  d.stats.baseline_built_ha = sumArea(oldBuilt, p.region, p.scale);
  d.stats.new_built_ha = sumArea(newBuilt, p.region, p.scale);
  d.stats.lost_built_ha = sumArea(lostBuilt, p.region, p.scale);
  var before = sumArea(oldBuilt.updateMask(common), p.region, p.scale);
  var after = sumArea(currentBuilt.updateMask(common), p.region, p.scale);
  d.stats.net_change_ha = after.subtract(before);
  d.stats.net_change_pct = ee.Algorithms.If(before.gt(0), after.subtract(before).divide(before).multiply(100), null);
  d.cards = [{key: 'current_built_ha', title: 'Analysis-year built-up cover', unit: 'ha'},
    {key: 'new_built_ha', title: 'New built-up on jointly observed pixels', unit: 'ha'},
    {key: 'net_change_pct', title: 'Net change on jointly observed pixels', unit: '%', decimals: 1}];
  d.stats.urban_activity_cells_30d = recent.cells;
  d.stats.urban_activity_area_30d_ha = recent.hectares;
  d.stats.urban_activity_support_ha = recent.support;
  d.stats.urban_latest_source_time = recent.latest;
  d.cards.unshift({key: 'urban_activity_cells_30d', title: '30-day potential urban-change activity', unit: '30 m cells'});
  d.notes.push('30-day activity compares the latest 30 days with the preceding 30 days, requiring ≥2 confident views in each window and a built-up probability increase ≥0.20. It is not a count of buildings, construction projects, vehicles or people.');
  d.notes.push('Sparse/cloudy observations can make the count unavailable; zero only means no cells met this screening rule on supported pixels.');
  if (activity) { d.source = 'Dynamic World • latest rolling 30 days versus previous 30 days • 30 m analysis'; d.collection = recent.collection; d.recentWindow = true; }
  d.notes.push('Built-up class area is not building footprint area. Validate expansions using imagery and planning records.');
  d.notes.push('A single consistent data source is used for comparisons; apparent reversals can reflect model error.');
  d.charts = function(token) {
    if (activity) {
      if (token !== state.token) return;
      resultBody.add(note('Activity rule: recent mean built-up probability ≥0.65; previous mean ≤0.45; increase ≥0.20; ≥2 confident views in each window.'));
      return;
    }
    var features = ee.FeatureCollection(ee.List.sequence(p.baseline, p.year).map(function(yy) {
      // Use server-side year dates; seasonal accepts a JavaScript year elsewhere.
      yy = ee.Number(yy);
      var c = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(country)
        .filterDate(ee.Date.fromYMD(yy, 1, 1), ee.Date.fromYMD(yy.add(1), 1, 1));
      if (p.season === 'Wet months (Nov–Mar)') c = c.filter(ee.Filter.or(
        ee.Filter.calendarRange(1, 3, 'month'), ee.Filter.calendarRange(11, 12, 'month')));
      if (p.season === 'Dry months (Apr–Oct)') c = c.filter(ee.Filter.calendarRange(4, 10, 'month'));
      var probs = safeComposite(c, DW_BANDS, 'mean', 10);
      var lc = probs.toArray().arrayArgmax().arrayGet([0])
        .updateMask(probs.reduce(ee.Reducer.max()).gte(CONFIG.confidence));
      return ee.Feature(null, {year: yy, hectares: ee.Algorithms.If(c.size().gt(0),
        sumArea(lc.eq(6), p.region, p.scale), null)});
    }));
    var opts = chartOptions('Annual built-up cover • sampling ' + p.scale + ' m', 'Hectares', '#EA580C');
    opts.hAxis = {title: 'Year', format: '####'};
    addFeatureChart(features, 'year', ['hectares'], opts, token);
  };
  return d;
}
function fireModule(p) {
  var activity = fireActivity(p);
  var activityMap = p.indicator === '30-day activity';
  var data = activityMap ? activity.data : fireCollection(Number(fireDays.getValue()));
  var col = data.filtered;
  var composite = safeComposite(col, ['frp', 'acq_epoch', 'confidence'], 'max', 375);
  var age = ee.Image.constant(data.now.millis().divide(1000)).subtract(composite.select('acq_epoch')).divide(3600);
  var power = p.indicator === 'Peak fire radiative power', isAge = p.indicator === 'Latest detection age';
  var image = activityMap ? activity.frequency : power ? composite.select('frp') : isAge ? age : composite.select('confidence');
  var d = descriptor(image, p.indicator, activityMap ? 'detection days / cell' : power ? 'MW' : isAge ? 'hours' : 'confidence code',
    activityMap ? {min: 1, max: 30, palette: HEAT} : power ? {min: 0, max: 100, palette: HEAT} : isAge ?
      {min: 0, max: Number(fireDays.getValue()) * 24, palette: ['EF4444', 'F97316', 'FDE68A', 'CBD5E1']} :
      {min: 0, max: 2, palette: ['FDE68A', 'F97316', 'DC2626']},
    'NASA LANCE/FIRMS • S-NPP + NOAA-20 VIIRS • nominal 375 m • NRT', data.all,
    activityMap || power || isAge ? null : [{name: 'Low confidence', color: 'FDE68A'},
      {name: 'Nominal confidence', color: 'F97316'}, {name: 'High confidence', color: 'DC2626'}], 375);
  d.stats.fire_activity_30d = activity.count;
  d.stats.occupied_cells = rasterCellCount(composite.select('acq_epoch'), p.region, 375);
  d.stats.mean_peak_frp = average(composite.select('frp'), p.region, 375);
  d.stats.latest_epoch = composite.select('acq_epoch').reduceRegion({reducer: ee.Reducer.max(),
    geometry: p.region, scale: 375, crs: CONFIG.crs, maxPixels: CONFIG.maxPixels, tileScale: 4}).get('acq_epoch');
  d.cards = [{key: 'fire_activity_30d', title: '30-day fire activity count', unit: 'detection cell-days'},
    {key: 'occupied_cells', title: 'Occupied cells in displayed window', unit: '375 m cells'},
    {key: 'mean_peak_frp', title: 'Mean of cell peak FRP', unit: 'MW', decimals: 1}];
  d.recentWindow = true;
  d.notes.push('30-day activity is the sum of occupied 375 m cells in 30 rolling 24-hour buckets. Satellites are merged per bucket to reduce duplicate counting. It is not a unique-fire incident count.');
  d.notes.push('Displayed window: ' + (activityMap ? 30 : fireDays.getValue()) + ' days ending ' + utcNow.toISOString() + '. Year/season controls do not apply.');
  d.notes.push('No detections does not mean no fires. Cloud cover and overpass timing matter. Cell area is not burned area; NRT detections need verification.');
  d.charts = function(token) {
    var fc = ee.FeatureCollection(activity.daily.toList(activity.daily.size()).map(function(im) {
      im = ee.Image(im);
      return ee.Feature(null, {date: im.get('system:time_start'), value: rasterCellCount(im, p.region, 375)});
    }));
    var opts = chartOptions('Fire activity • rolling 30 days', 'Detection cells', '#EA580C');
    opts.hAxis = {title: 'UTC bucket start', format: 'dd MMM'};
    addFeatureChart(fc, 'date', ['value'], opts, token);
  };
  return d;
}
function annualProductivity(p) {
  var annual = ee.ImageCollection.fromImages(ee.List.sequence(p.baseline, p.year).map(function(yy) {
    yy = ee.Number(yy);
    var col = ee.ImageCollection('MODIS/061/MOD13Q1').filterBounds(country)
      .filterDate(ee.Date.fromYMD(yy, 1, 1), ee.Date.fromYMD(yy.add(1), 1, 1));
    if (p.season === 'Wet months (Nov–Mar)') col = col.filter(ee.Filter.or(
      ee.Filter.calendarRange(1, 3, 'month'), ee.Filter.calendarRange(11, 12, 'month')));
    if (p.season === 'Dry months (Apr–Oct)') col = col.filter(ee.Filter.calendarRange(4, 10, 'month'));
    col = col.map(function(im) { return im.select('NDVI').multiply(0.0001)
      .updateMask(im.select('SummaryQA').lte(1)).rename('NDVI'); });
    var mean = safeComposite(col, ['NDVI'], 'mean', 250);
    var time = ee.Image.constant(yy.subtract(p.baseline)).toFloat().rename('time').updateMask(mean.mask());
    return time.addBands(mean).set('system:time_start', ee.Date.fromYMD(yy, 1, 1).millis()).set('year', yy);
  }));
  var n = annual.select('NDVI').count();
  var trend = annual.select(['time', 'NDVI']).reduce(ee.Reducer.linearFit()).select('scale')
    .updateMask(n.gte(4)).rename('trend').setDefaultProjection(CONFIG.crs, null, 250);
  return {annual: annual, trend: trend};
}
function coverDegradation(p) {
  var cur = dwFor(p.year, p.season), old = dwFor(p.baseline, p.season);
  var a = old.lc, b = cur.lc, ha = habitat(a), hb = habitat(b);
  var degraded = ha.and(b.eq(4).or(b.eq(6)).or(b.eq(7)))
    .or(a.eq(4).and(b.eq(6).or(b.eq(7)))).or(a.eq(0).and(b.eq(7)));
  var improved = a.eq(7).and(hb.or(b.eq(4))).or(a.eq(4).and(hb));
  var classification = a.multiply(0).toByte().where(degraded, 1).where(improved, 2)
    .updateMask(a.mask().and(b.mask())).rename('condition');
  return {image: classification, cur: cur, old: old};
}
function productivityChart(product, p, token) {
  var features = ee.FeatureCollection(product.annual.toList(product.annual.size()).map(function(im) {
    im = ee.Image(im); var yy = ee.Number(im.get('year'));
    var rainfall = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').filterBounds(country)
      .filterDate(ee.Date.fromYMD(yy, 1, 1), ee.Date.fromYMD(yy.add(1), 1, 1));
    if (p.season === 'Wet months (Nov–Mar)') rainfall = rainfall.filter(ee.Filter.or(
      ee.Filter.calendarRange(1, 3, 'month'), ee.Filter.calendarRange(11, 12, 'month')));
    if (p.season === 'Dry months (Apr–Oct)') rainfall = rainfall.filter(ee.Filter.calendarRange(4, 10, 'month'));
    var rain = rainfall.select('precipitation').merge(ee.ImageCollection.fromImages([
      masked(['precipitation'], 5566)])).sum().updateMask(rainfall.select('precipitation').count().gt(0));
    return ee.Feature(null, {year: yy, NDVI: average(im.select('NDVI'), p.region, 250),
      rainfall: average(rain, p.region, 5566)});
  }));
  var opts = chartOptions('Productivity and rainfall • selected season', 'NDVI');
  opts.legend = {position: 'bottom'}; opts.colors = [C.teal, '#3B82F6'];
  opts.hAxis = {title: 'Year', format: '####'};
  opts.series = {0: {targetAxisIndex: 0}, 1: {targetAxisIndex: 1}};
  opts.vAxes = {0: {title: 'NDVI'}, 1: {title: 'Rainfall (mm)'}}; opts.chartArea.right = 58;
  addFeatureChart(features, 'year', ['NDVI', 'rainfall'], opts, token);
}
function degradationModule(p) {
  var d;
  if (p.indicator === 'Land productivity' || p.indicator === 'Restoration & recovery') {
    var product = annualProductivity(p), trend = product.trend;
    var recovery = p.indicator === 'Restoration & recovery';
    var image = trend, units = 'NDVI/year', categories = null;
    var vis = {min: -0.03, max: 0.03, palette: DIVERGE};
    if (recovery) {
      var transition = coverDegradation(p).image;
      var greening = trend.gt(CONFIG.trendThreshold);
      var favourable = transition.eq(2).setDefaultProjection(CONFIG.crs, null, 10)
        .reduceResolution({reducer: ee.Reducer.mean(), maxPixels: 4096})
        .reproject({crs: CONFIG.crs, scale: 250}).gte(0.5);
      image = greening.toByte().add(favourable.multiply(2)).updateMask(trend.mask()).updateMask(favourable.mask());
      vis = {min: 0, max: 3, palette: ['E2E8F0', 'A3E635', '38BDF8', '047857']}; units = 'class code';
      categories = [{name: 'No qualifying recovery signal', color: 'E2E8F0'},
        {name: 'Positive NDVI trend only', color: 'A3E635'}, {name: 'Favourable cover transition only', color: '38BDF8'},
        {name: 'Both signals', color: '047857'}];
    }
    d = descriptor(image, p.indicator, units, vis, recovery ?
      'MODIS NDVI + Dynamic World transitions • 250 m screening grid' :
      'MODIS MOD13Q1 • QA-screened annual seasonal mean NDVI • 250 m', product.annual, categories, 250);
    d.stats.mean_trend = average(trend, p.region, 250);
    d.stats.declining_ha = sumArea(trend.lt(-CONFIG.trendThreshold), p.region, 250);
    d.stats.greening_ha = sumArea(trend.gt(CONFIG.trendThreshold), p.region, 250);
    d.cards = [{key: 'mean_trend', title: 'Mean productivity trend', unit: 'NDVI/year', decimals: 4},
      {key: recovery ? 'greening_ha' : 'declining_ha', title: recovery ? 'Potential greening / recovery' : 'Potential productivity decline', unit: 'ha'}];
    if (recovery) d.batchImage = image.rename('recovery').toFloat().addBands(trend.rename('trend').toFloat());
    if (recovery) { d.stats.both_signals_ha = sumArea(image.eq(3), p.region, 250);
      d.cards.push({key: 'both_signals_ha', title: 'Both recovery signals', unit: 'ha'}); }
    d.notes.push('Regression requires ≥4 observed years. Trend thresholds are ±' + CONFIG.trendThreshold + ' NDVI/year, not significance tests or official productivity state/performance indicators.');
    d.notes.push('Rainfall, harvest, fire, succession and management can affect NDVI. Greening is not proof of successful restoration or biodiversity recovery.');
    d.charts = function(token) { productivityChart(product, p, token); };
  } else if (p.indicator === 'Land-cover degradation') {
    var cover = coverDegradation(p);
    d = descriptor(cover.image, p.indicator, 'class code', {min: 0, max: 2, palette: ['94A3B8', 'DC2626', '16A34A']},
      'Dynamic World • explicit provisional land-cover transition rules • 10 m', cover.cur.source,
      [{name: 'Stable / neutral under selected rules', color: '94A3B8'}, {name: 'Potentially degraded', color: 'DC2626'},
        {name: 'Potentially improved', color: '16A34A'}], 10);
    d.stats.stable_ha = sumArea(cover.image.eq(0), p.region, p.scale);
    d.stats.degraded_ha = sumArea(cover.image.eq(1), p.region, p.scale);
    d.stats.improved_ha = sumArea(cover.image.eq(2), p.region, p.scale);
    d.cards = [{key: 'stable_ha', title: 'Stable / neutral', unit: 'ha'},
      {key: 'degraded_ha', title: 'Potentially degraded', unit: 'ha'}, {key: 'improved_ha', title: 'Potentially improved', unit: 'ha'}];
    d.notes.push('Degraded: habitat proxy → crop/built/bare; crop → built/bare; water → bare. Improved: bare → vegetation/crop; crop → habitat proxy. Other transitions are neutral under these provisional rules.');
    d.notes.push('Stable includes unclassified neutral transitions, not necessarily unchanged land cover. Validate rules for local ecosystems: tree gain is not always improvement in grasslands.');
    d.charts = function(token) {
      if (token !== state.token) return;
      resultBody.add(ui.Chart.feature.byFeature(ee.FeatureCollection([
        ee.Feature(null, {condition: 'Stable', hectares: d.stats.stable_ha}),
        ee.Feature(null, {condition: 'Degraded', hectares: d.stats.degraded_ha}),
        ee.Feature(null, {condition: 'Improved', hectares: d.stats.improved_ha})
      ]), 'condition', ['hectares']).setChartType('ColumnChart')
        .setOptions({title: 'Land-cover condition • hectares', colors: [C.teal], legend: {position: 'none'}, height: 200}));
    };
  } else if (p.indicator === 'Persistent bare ground') {
    var bareCol = seasonal(ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(country), p.year, 'Full year')
      .map(function(im) { var conf = im.select(DW_BANDS).reduce(ee.Reducer.max());
        return im.select('label').eq(7).rename('bare').toFloat().updateMask(conf.gte(CONFIG.confidence))
          .copyProperties(im, ['system:time_start']); });
    var monthly = ee.ImageCollection.fromImages(ee.List.sequence(1, 12).map(function(m) {
      var start = ee.Date.fromYMD(p.year, m, 1);
      var mean = safeComposite(bareCol.filterDate(start, start.advance(1, 'month')), ['bare'], 'mean', 10);
      return mean.gte(0.6).rename('bare_month').set('system:time_start', start.millis());
    }));
    var validMonths = monthly.count();
    var persistence = monthly.sum().divide(validMonths.max(1)).multiply(100)
      .updateMask(validMonths.gte(6)).rename('persistence').setDefaultProjection(CONFIG.crs, null, 10);
    d = descriptor(persistence, p.indicator, '% of observed months', {min: 0, max: 100, palette: HEAT},
      'Dynamic World • monthly bare-ground persistence • full calendar year', bareCol, null, 10);
    d.stats.persistent_ha = sumArea(persistence.gte(75), p.region, p.scale);
    d.stats.mean_persistence = average(persistence, p.region, p.scale);
    d.cards = [{key: 'persistent_ha', title: 'Bare in ≥75% of observed months', unit: 'ha'},
      {key: 'mean_persistence', title: 'Mean bare-ground persistence', unit: '%', decimals: 1}];
    d.notes.push('A bare month has bare class in ≥60% of confident views. At least 6 observed months are required. This subtab uses the full year, independent of the season selector.');
    d.notes.push('Naturally bare terrain, harvested land and construction can also be persistent bare ground; validate land use before calling degradation.');
    d.charts = function(token) { addMonthly(bareCol, 'bare', p, 'Bare fraction', 'Monthly observed bare-ground fraction', token); };
  } else if (p.indicator === 'Erosion susceptibility') {
    var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003'));
    var slopeFraction = slope.multiply(Math.PI / 180).tan();
    var col = s2Collection(p.year, p.season), vegetation = safeComposite(col, ['NDVI'], 'median', 20);
    var exposure = ee.Image.constant(1).subtract(vegetation.subtract(0.15).divide(0.65).clamp(0, 1));
    var screen = slopeFraction.multiply(exposure).rename('susceptibility');
    var coverMask = dwFor(p.year, p.season).lc;
    screen = screen.updateMask(coverMask.neq(0).and(coverMask.neq(6))).setDefaultProjection(CONFIG.crs, null, 30);
    d = descriptor(screen, p.indicator, 'relative index', {min: 0, max: 0.5, palette: HEAT},
      'SRTM slope × Sentinel-2 vegetation exposure • relative 30 m screen', col, null, 30);
    d.stats.mean_susceptibility = average(screen, p.region, Math.max(p.scale, 30));
    d.stats.elevated_screen_ha = sumArea(screen.gt(0.2), p.region, Math.max(p.scale, 30));
    d.cards = [{key: 'mean_susceptibility', title: 'Mean relative susceptibility', unit: 'index', decimals: 3},
      {key: 'elevated_screen_ha', title: 'Screening index >0.2', unit: 'ha'}];
    d.notes.push('Index = tan(slope) × vegetation exposure. Water and built-up land are excluded. Display thresholds are screening choices.');
    d.notes.push('Rainfall erosivity, soil erodibility and conservation practices are not modelled. This is not RUSLE or soil loss in tonnes/ha/year.');
    d.charts = function(token) { addMonthly(s2Collection(p.year, 'Full year'), 'NDVI', p,
      'NDVI', 'Vegetation-cover context', token); };
  } else {
    var depth = soilDepth.getValue();
    var carbon = ee.Image('OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02')
      .select('b' + depth).multiply(5).rename('SOC');
    d = descriptor(carbon, p.indicator, 'g/kg', {min: 0, max: 100, palette: GREEN},
      'OpenLandMap predicted SOC concentration • 250 m • depth ' + depth + ' cm', null, null, 250);
    d.stats.mean_soc = average(carbon, p.region, 250);
    d.cards = [{key: 'mean_soc', title: 'Mean SOC concentration at ' + depth + ' cm', unit: 'g/kg', decimals: 1}];
    d.notes.push('Stored values are multiplied by the documented scale factor of 5. This is a static soil prediction, not annual measurements or carbon-stock change.');
    d.notes.push('Depth bands are point-depth predictions, not a 0–30 cm integrated stock. Year/baseline/season controls do not apply; repeat sampling is needed to assess carbon decline.');
    d.charts = function(token) {
      if (token !== state.token) return;
      var depths = [0, 10, 30, 60, 100, 200];
      var features = ee.FeatureCollection(depths.map(function(z) { return ee.Feature(null, {depth: z,
        value: average(ee.Image('OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02')
          .select('b' + z).multiply(5), p.region, 250)}); }));
      resultBody.add(ui.Chart.feature.byFeature(features, 'depth', ['value']).setChartType('LineChart')
        .setOptions({title: 'Predicted soil carbon profile', hAxis: {title: 'Depth (cm)'},
          vAxis: {title: 'SOC (g/kg)'}, colors: [C.teal], legend: {position: 'none'}, pointSize: 4, height: 210}));
    };
  }
  d.notes.push('These indicators support screening and prioritisation; they are not a validated national SDG 15.3.1 assessment.');
  return d;
}
// ---------------------------------------------------------------------------
// ANALYSIS / ASYNCHRONOUS STATE
// ---------------------------------------------------------------------------
function metricSamplingScale(d, p, key) {
  if (key === 'area_ha' || /time$/.test(key) || /epoch$/.test(key) || key === 'source_count' || key === 'recorded_species') return null;
  if (key === 'valid_indicator_ha' || key === 'valid_pct') return Math.max(p.scale, d.scale);
  if (/^urban_activity/.test(key)) return CONFIG.urbanActivityScale;
  if (p.module === 5) return 375;
  if (p.module === 2) return 1113.2;
  if (p.module === 1 && p.indicator === 'Biodiversity Intactness Index (BII)') return 100;
  if (p.module === 1 && p.indicator === 'Ecosystem condition') return 1000;
  if (p.module === 1 && p.indicator === 'Canopy height') return /samples$/.test(key) ? null : 30;
  if (p.module === 1 && p.indicator === 'Habitat fragmentation') return 100;
  if (p.module === 6 && ['Land productivity', 'Restoration & recovery', 'Soil organic carbon'].indexOf(p.indicator) !== -1) return 250;
  if (p.module === 6 && p.indicator === 'Erosion susceptibility') return Math.max(p.scale, 30);
  if (p.module === 3 && key === 'mean') return Math.max(p.scale, 20);
  return p.scale;
}
function analyse() {
  utcNow = new Date();
  var token = ++state.token, p = params();
  state.current = null; state.table = null;
  inspectLabel.setValue('Click the map to inspect the displayed indicator.');
  resultBody.clear(); results.style().set('shown', true);
  status.setValue('Computing ' + p.indicator + '…'); status.style().set('color', C.muted);
  var recentOnly = p.module === 5 || (p.module === 4 && p.indicator === '30-day activity');
  var staticOnly = p.module === 6 && p.indicator === 'Soil organic carbon';
  syncIndicatorControls();
  if (!recentOnly && !staticOnly && !(p.module === 1 && p.indicator === 'Canopy height') && p.baseline >= p.year) {
    status.setValue('Choose a baseline year earlier than the analysis year.');
    status.style().set('color', C.red); return;
  }
  if (p.module === 6 && (p.indicator === 'Land productivity' || p.indicator === 'Restoration & recovery') && p.year - p.baseline < 3) {
    status.setValue('NDVI trend needs at least four years, including both endpoints.');
    status.style().set('color', C.red); return;
  }
  if (p.module === 6 && p.indicator === 'Restoration & recovery' &&
      (!recoveryAsset || recoveryAsset.key !== recoveryKey(p))) {
    baseLayers(); outline(); legend.style().set('shown', false);
    resultBody.add(note('Recovery is computed through a batch asset export to avoid the map tile memory limit. Enter an asset ID in the sidebar, create the export, start it in Tasks, and load the completed asset.'));
    status.setValue('Recovery needs a completed asset for this area and comparison period.'); return;
  }
  var builders = [landModule, biodiversityModule, airModule, waterModule,
    urbanModule, fireModule, degradationModule];
  var d;
  try { d = p.module === 6 && p.indicator === 'Restoration & recovery' ? savedRecovery(p) : builders[p.module](p); }
  catch (err) { status.setValue('Setup error: ' + err.message); status.style().set('color', C.red); return; }
  d.params = p; state.current = d;
  baseLayers(); map.addLayer(d.image.clip(p.region), d.vis, d.title, true);
  if (d.overlay) map.addLayer(d.overlay, {}, 'Supplied species observations', true);
  if (CONFIG.protectedAreasAsset && p.module === 1) {
    map.addLayer(ee.FeatureCollection(CONFIG.protectedAreasAsset).filterBounds(p.region)
      .style({color: 'A855F7', fillColor: '00000000', width: 2}), {}, 'Supplied protected areas', true);
  }
  outline(); makeLegend(d);
  resultBody.add(label(d.title, {fontSize: '18px', fontWeight: 'bold', color: C.navy, margin: '0 0 6px'}));
  resultBody.add(note(d.source));
  var statsPanel = ui.Panel(); resultBody.add(statsPanel);
  d.stats.area_ha = p.region.area(100).divide(10000);
  d.stats.valid_indicator_ha = sumArea(d.image.mask(), p.region, Math.max(p.scale, d.scale));
  d.stats.valid_pct = ee.Number(d.stats.valid_indicator_ha).divide(d.stats.area_ha).multiply(100);
  if (d.collection) {
    d.stats.source_count = d.collection.size();
    d.stats.latest_source_time = d.collection.aggregate_max('system:time_start');
  }
  var records = Object.keys(d.stats).map(function(k) {
    var matchingCard = d.cards.filter(function(card) { return card.key === k; })[0];
    var unit = matchingCard ? matchingCard.unit : /_ha$/.test(k) ? 'ha' :
      /_pct$/.test(k) ? '%' : /epoch$/.test(k) ? 'Unix seconds' :
      /time$/.test(k) ? 'Unix milliseconds' : /^class_/.test(k) ? 'ha' : '';
    return ee.Feature(null, {record_type: 'summary', metric: k, value: d.stats[k],
      unit: unit,
      area: p.areaName, module: MODULES[p.module].name, indicator: d.title,
      analysis_year: recentOnly || staticOnly ? null : p.year,
      actual_data_year: recentOnly || staticOnly ? null : d.actualYear || p.year,
      baseline: recentOnly || staticOnly || (p.module === 1 && p.indicator === 'Canopy height') ? null : p.baseline,
      season: recentOnly ? 'recent window' : staticOnly ? 'static baseline' : (p.module === 1 && p.indicator === 'Canopy height') ? 'fixed 2022–2023 reference' : p.season,
      sampling_scale_m: metricSamplingScale(d, p, k), requested_sampling_scale_m: p.scale,
      source_resolution_m: d.scale, generated_utc: utcNow.toISOString(),
      fire_window_days: p.module === 5 ? (p.indicator === '30-day activity' ? 30 : Number(fireDays.getValue())) : null,
      activity_window_days: p.module === 4 || p.module === 5 ? 30 : null,
      area_type: state.areaName.indexOf('Admin2:') === 0 ? 'ADM2' : state.areaName === 'Eswatini' ? 'country' : 'custom'});
  });
  state.table = ee.FeatureCollection(records);
  ee.Dictionary(d.stats).evaluate(function(values, error) {
    if (token !== state.token) return;
    if (error || !values) {
      status.setValue('Analysis unavailable. Try a smaller area or coarser statistics scale.');
      status.style().set('color', C.red);
      statsPanel.add(note('Earth Engine reported: ' + (error || 'No response'))); return;
    }
    // Metrics inserted before notes/charts through a dedicated container.
    var savedBody = resultBody; resultBody = statsPanel;
    metric('Selected area', fmt(values.area_ha, 0), 'ha');
    d.cards.forEach(function(card) { metric(card.title, fmt(values[card.key], card.decimals || 0), card.unit); });
    resultBody = savedBody;
    if (p.module !== 5) statsPanel.add(note('Indicator support: ' + fmt(values.valid_pct, 1) +
      '% of selected area. Low support can reflect masking or a restricted indicator such as water.'));
    else if (values.latest_epoch) statsPanel.add(note('Latest qualifying detection: ' +
      new Date(values.latest_epoch * 1000).toISOString()));
    if (values.latest_source_time) statsPanel.add(note('Latest source image: ' +
      new Date(values.latest_source_time).toISOString().slice(0, 10)));
    if (values.source_count !== undefined) statsPanel.add(note('Source images: ' + values.source_count +
      ' (image count is not pixel observation coverage).'));
    if (p.module === 4) {
      statsPanel.add(note('30-day urban comparison support: ' + fmt(values.urban_activity_support_ha, 0) + ' ha.'));
      if (values.urban_latest_source_time) statsPanel.add(note('Latest recent urban source: ' +
        new Date(values.urban_latest_source_time).toISOString().slice(0, 10)));
    }
    if (values.valid_indicator_ha === 0) statsPanel.add(note('No supported indicator pixels. Zero mapped area can reflect missing data.'));
    status.setValue(values.valid_indicator_ha > 0 ? 'Analysis complete • click map to inspect.' :
      'Completed • no supported pixels for this indicator.');
    status.style().set('color', values.valid_indicator_ha > 0 ? C.teal : C.amber);
  });
  resultBody.add(heading('INTERPRETATION'));
  d.notes.forEach(function(n) { resultBody.add(note(n)); });
  if (d.charts) d.charts(token);
}
function invalidate() {
  state.token++; state.inspection++; state.current = null; state.table = null;
  baseLayers(); outline(); legend.style().set('shown', false);
  resultBody.clear(); resultBody.add(note('Settings changed. Click ANALYSE AREA to refresh results.'));
  status.setValue('Settings changed • analysis required.');
}
function switchModule(index) {
  state.module = index;
  navButtons.forEach(function(b, i) {
    b.style().set({backgroundColor: i === index ? C.navy : C.paper,
      color: i === index ? C.mint : C.teal, border: '1px solid ' + (i === index ? C.navy : C.line)});
  });
  about.setValue(MODULES[index].about);
  fireOptions.style().set('shown', index === 5);
  layerSelect.items().reset(MODULES[index].items);
  layerSelect.setValue(MODULES[index].items[0], false);
  buildSubtabs(); syncIndicatorControls();
  invalidate(); analyse();
}
function buildSubtabs() {
  subtabPanel.clear();
  var active = layerSelect.getValue();
  MODULES[state.module].items.forEach(function(name) {
    var b = button(name, function() {
      layerSelect.setValue(name, false); buildSubtabs(); syncIndicatorControls(); invalidate(); analyse();
    }, false);
    b.style().set({backgroundColor: name === active ? '#D5F5EF' : C.paper,
      color: name === active ? '#065F46' : C.ink, border: name === active ? '1px solid #14B8A6' : '1px solid #D9E2EC'});
    subtabPanel.add(b);
  });
}
function syncIndicatorControls() {
  var name = layerSelect.getValue(), m = state.module;
  var recent = m === 5 || (m === 4 && name === '30-day activity');
  var soil = m === 6 && name === 'Soil organic carbon';
  var annualModel = m === 1 && (name === 'Biodiversity Intactness Index (BII)' || name === 'Ecosystem condition');
  var canopy = m === 1 && name === 'Canopy height';
  yearSelect.setDisabled(recent || soil || canopy);
  baseSelect.setDisabled(recent || soil || canopy);
  seasonSelect.setDisabled(recent || soil || annualModel || canopy || (m === 6 && name === 'Persistent bare ground'));
  soilOptions.style().set('shown', soil);
  recoveryOptions.style().set('shown', m === 6 && name === 'Restoration & recovery');
  fireDays.setDisabled(m === 5 && name === '30-day activity');
}
function selectRegion(name) {
  if (!name) return;
  draw.stop(); draw.setShown(false); draw.layers().reset([]);
  // Country overview only. Local administrative analysis uses global ADM2 below.
  state.region = country;
  state.areaName = name; areaCaption.setValue('Analysing: ' + name);
  admin2Select.setValue(null, false);
  villageSelect.setValue(null, false);
  map.centerObject(state.region); invalidate(); analyse();
}
function admin2DisplayName(selector) {
  return String(selector).split('|')[0].replace(/^\s*inkhundla\s+/i, '').trim();
}
function loadAdmin2() {
  var request = ++admin2LoadToken;
  admin2Select.setDisabled(true); admin2Status.setValue('Loading global Admin2 boundaries…');
  var collection = ee.FeatureCollection('WM/geoLab/geoBoundaries/600/ADM2')
    .filter(ee.Filter.eq('shapeGroup', 'SWZ'));
  var prepared = collection.map(function(f) {
    var name = ee.String(ee.Algorithms.If(f.get('shapeName'), f.get('shapeName'), f.id()));
    return f.set('__adm2_selector', name.cat(' | ').cat(ee.String(f.id())));
  });
  prepared.aggregate_array('__adm2_selector').sort().evaluate(function(names, error) {
    if (request !== admin2LoadToken) return;
    if (error || !names || !names.length) {
      admin2Status.setValue('Admin2 unavailable: ' + (error || 'no Eswatini features in this release') + '. Draw a polygon to continue.');
      return;
    }
    admin2Collection = prepared;
    var items = names.map(function(selector) {
      return {label: admin2DisplayName(selector), value: selector};
    });
    items.sort(function(a, b) { return a.label.localeCompare(b.label); });
    admin2Select.items().reset(items); admin2Select.setDisabled(false);
    admin2Status.setValue(names.length + ' Admin2 areas available • geoBoundaries v6.0.');
  });
}
function selectAdmin2(selector) {
  if (!selector || !admin2Collection) return;
  draw.stop(); draw.layers().reset([]); draw.setShown(false);
  state.region = admin2Collection.filter(ee.Filter.eq('__adm2_selector', selector)).geometry(10)
    .intersection(country, 10);
  state.areaName = 'Admin2: ' + admin2DisplayName(selector);
  areaCaption.setValue('Analysing: ' + state.areaName);
  villageSelect.setValue(null, false); map.centerObject(state.region);
  invalidate(); analyse();
}
function selectVillage(name) {
  if (!name || !CONFIG.villagesAsset) return;
  var selected = ee.FeatureCollection(CONFIG.villagesAsset).filter(ee.Filter.eq(CONFIG.villageField, name));
  // Point villages become explicit 2 km neighbourhoods. Polygon villages retain geometry.
  var geom = selected.geometry(100);
  var polygon = ee.Geometry(ee.Algorithms.If(ee.Algorithms.IsEqual(geom.type(), 'Point'), geom.buffer(2000),
    ee.Algorithms.If(ee.Algorithms.IsEqual(geom.type(), 'MultiPoint'), geom.buffer(2000), geom)));
  state.region = polygon.intersection(country, 100);
  state.areaName = 'Village: ' + name + ' (points use a 2 km buffer)';
  areaCaption.setValue('Analysing: ' + state.areaName);
  map.centerObject(state.region); invalidate(); analyse();
}
function startDraw() {
  draw.layers().reset([]);
  draw.setShown(true); draw.setShape('polygon'); draw.draw();
  status.setValue('Draw a polygon. Double-click to finish, then choose Use drawn area.');
}
function useDrawn() {
  draw.stop();
  if (draw.layers().length() === 0) { status.setValue('Draw a polygon first.'); return; }
  var layer = draw.layers().get(0);
  if (layer.geometries().length() === 0) { status.setValue('Finish drawing the polygon first.'); return; }
  var geometry = ee.Geometry(layer.geometries().get(0));
  var region = geometry.intersection(country, 100), token = ++state.token;
  region.area(100).evaluate(function(area, error) {
    if (token !== state.token) return;
    if (error || !area || area < 100) { status.setValue('Select a polygon overlapping Eswatini (at least 100 m²).'); return; }
    state.region = region; state.areaName = 'Drawn area'; areaCaption.setValue('Analysing: Drawn area');
    draw.layers().reset([]); draw.setShown(false); invalidate(); analyse();
  });
}
function home() {
  draw.stop(); draw.layers().reset([]); draw.setShown(false);
  state.region = country; state.areaName = 'Eswatini';
  areaSelect.setValue('Eswatini', false); villageSelect.setValue(null, false);
  admin2Select.setValue(null, false);
  areaCaption.setValue('Analysing: Eswatini'); map.centerObject(country, 8);
  invalidate(); analyse();
}
function clearResults() {
  state.token++; state.inspection++; state.current = null; state.table = null;
  baseLayers(); outline(); resultBody.clear(); resultBody.add(note('Results cleared. Click ANALYSE AREA to begin.'));
  legend.style().set('shown', false); inspectLabel.setValue('Click the map after running an analysis.');
  status.setValue('Results cleared.');
}
map.onClick(function(coords) {
  if (!state.current) return;
  var d = state.current, token = state.token, request = ++state.inspection;
  inspectLabel.setValue('Inspecting…');
  var point = ee.Geometry.Point([coords.lon, coords.lat]);
  d.image.clip(d.params.region).reduceRegion({reducer: ee.Reducer.first(), geometry: point,
    scale: d.scale, crs: CONFIG.crs, maxPixels: 10000}).evaluate(function(v, error) {
      if (token !== state.token || request !== state.inspection) return;
      if (error || !v || v.value === null || v.value === undefined) {
        inspectLabel.setValue('No valid indicator pixel at this point.'); return;
      }
      var value = d.title === 'Land cover' ? LC_NAMES[Math.round(v.value)] : fmt(v.value, 4) + ' ' + d.units;
      inspectLabel.setValue(d.title + ': ' + value + '\n' + coords.lat.toFixed(4) + ', ' + coords.lon.toFixed(4));
    });
});
function recoveryKey(p) {
  return [p.areaName, p.baseline, p.year, p.season, CONFIG.trendThreshold, CONFIG.confidence].join('|');
}
function exportRecoveryAsset() {
  if (typeof Export === 'undefined') { status.setValue('Create the batch task in the Earth Engine Code Editor.'); return; }
  var p = params(), id = String(recoveryAssetInput.getValue() || '').trim();
  if (p.module !== 6 || p.indicator !== 'Restoration & recovery') return;
  if (!/^projects\/[^/]+\/assets\/.+/.test(id)) { status.setValue('Enter a full writable projects/PROJECT/assets/IMAGE asset ID.'); return; }
  if (p.year - p.baseline < 3) { status.setValue('Choose a comparison period with at least four years.'); return; }
  var d = degradationModule(p);
  Export.image.toAsset({image: d.batchImage.clip(p.region).set({
      recovery_key: recoveryKey(p), baseline_year: p.baseline, analysis_year: p.year,
      recovery_region: p.region, season: p.season}),
    description: 'Eswatini_Recovery_' + p.baseline + '_' + p.year,
    assetId: id, region: p.region, scale: 250, crs: CONFIG.crs,
    maxPixels: 1000000000, shardSize: 64,
    pyramidingPolicy: {recovery: 'mode', trend: 'mean'}});
  status.setValue('Asset export task created. Click Run in Tasks. When completed, click Load completed recovery asset.');
}
function loadRecoveryAsset() {
  var p = params(), id = String(recoveryAssetInput.getValue() || '').trim();
  if (!id) { status.setValue('Enter the completed recovery asset ID.'); return; }
  var image = ee.Image(id), token = ++state.token;
  status.setValue('Checking completed recovery asset…');
  image.toDictionary(['recovery_key']).evaluate(function(meta, error) {
    if (token !== state.token) return;
    if (error) { status.setValue('Asset unavailable. Wait for the export to complete and check the asset ID.'); return; }
    if (!meta || meta.recovery_key !== recoveryKey(p)) { status.setValue('Asset comparison settings do not match. Select the exported area, years and season.'); return; }
    recoveryAsset = {image: image, key: recoveryKey(p)}; analyse();
  });
}
function savedRecovery(p) {
  var image = recoveryAsset.image;
  // Intersect with exported geometry so a different drawn polygon cannot silently
  // display incomplete coverage under the same Drawn area label.
  var exportedRegion = ee.Geometry(image.get('recovery_region'));
  p.region = p.region.intersection(exportedRegion, 100);
  var classes = image.select('recovery'), trend = image.select('trend');
  var d = descriptor(classes, 'Restoration & recovery', 'class code',
    {min: 0, max: 3, palette: ['E2E8F0', 'A3E635', '38BDF8', '047857']},
    'Completed batch asset • MODIS trend + Dynamic World transitions • 250 m', null,
    [{name: 'No qualifying recovery signal', color: 'E2E8F0'},
      {name: 'Positive NDVI trend only', color: 'A3E635'},
      {name: 'Favourable cover transition only', color: '38BDF8'},
      {name: 'Both signals', color: '047857'}], 250);
  d.stats.mean_trend = average(trend, p.region, 250);
  d.stats.greening_ha = sumArea(classes.eq(1).or(classes.eq(3)), p.region, 250);
  d.stats.favourable_ha = sumArea(classes.eq(2).or(classes.eq(3)), p.region, 250);
  d.stats.both_signals_ha = sumArea(classes.eq(3), p.region, 250);
  d.cards = [{key: 'mean_trend', title: 'Mean productivity trend', unit: 'NDVI/year', decimals: 4},
    {key: 'greening_ha', title: 'Positive NDVI trend', unit: 'ha'},
    {key: 'favourable_ha', title: 'Favourable cover transitions', unit: 'ha'},
    {key: 'both_signals_ha', title: 'Both recovery signals', unit: 'ha'}];
  d.notes.push('Map and statistics read the completed raster asset without recomputing the source stack. Display is restricted to the overlap of the selected and exported regions.');
  d.notes.push('Potential recovery signals require local validation; greening is not proof of successful restoration.');
  return d;
}

// Public global ADM2 selector. ADM1 is used only to construct the country outline.
loadAdmin2();
if (CONFIG.villagesAsset) {
  ee.FeatureCollection(CONFIG.villagesAsset).aggregate_array(CONFIG.villageField).distinct().sort()
    .evaluate(function(names, error) {
      if (error) { villageSelect.setDisabled(true); print('Optional village asset unavailable', error); return; }
      villageSelect.items().reset(names || []);
    });
}
switchModule(0);
// ============================================================================
// END OF SCRIPT
// ============================================================================
