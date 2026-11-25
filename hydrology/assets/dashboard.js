function siegGlobalSlope(){return ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003')).unmask(ee.Terrain.slope(ee.Image('NOAA/NGDC/ETOPO1').select('ice_surface')).rename('slope'),false);}
// ================================================================
// SIEG Hydrology DASHBOARD
// Google Earth Engine JavaScript
// ================================================================
// VERSION 4 — Navigation follows the supplied ten-module reference.
// 01 Basins | 02 Rainfall | 03 Evapotranspiration
// 04 Groundwater Recharge | 05 Surface water | 06 Water balance
// 07 Turbidity | 08 Suitable Spots for Wells
// 09 Demand & stress | 10 Warnings & restoration
// Dam volume and river flow retain explicit measured/scenario inputs.
// Static reference layers do not change date with the selected year.
//
// No private assets required.
//
// Optional imports:
// CONFIG.boreholes: FeatureCollection with fields:
//   name, water_level_m, yield_lps
//   water_level_m = measured depth below ground.
//
// CONFIG.basins: FeatureCollection with a "name" field.
//
// Scientific interpretation:
// - Recharge index = uncalibrated surface screening.
// - Rainfall minus ET = climatic balance, not recharge.
// - Optical turbidity index = proxy, not measured NTU.
// - Warning indicators = retrospective, not forecasts.
// ================================================================


// ================================================================
// 1. CONFIGURATION
// ================================================================

var CONFIG = {
  boreholes: null,
  basins: null,
  basinNameField: 'superbasin', // For optional imported basins. Public basins use HYBAS_ID.
  // Optional surveyed bed ELEVATION raster, metres. Datum must match water level.
  // Existing-water SRTM is NOT bathymetry. Use verified survey/pre-dam terrain.
  bathymetry: null,
  bathymetryScale: 10,
  // Optional locally validated aquifer favourability image in [0,1].
  // No geological asset is assumed or invented by the dashboard.
  aquiferFavorability: null
};

var C = {
  navy: '#0b2338',
  teal: '#218b8c',
  ink: '#183B62',
  muted: '#667A90',
  pale: '#eee8dc',
  white: '#FFFFFF',
  gold: '#B59A70',
  adminGrey: '#808080'
};

var hydroPalette = ['F4EBDD','D1DFED','91B9DE','4689C3','123D71'];

var diverge = [
  'B59A70',
  'E8DCC6',
  'FFFFFF',
  '91B9DE',
  '123D71'
];


// ================================================================
// 2. PUBLIC DATASETS
// ================================================================

var boundary = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(
    ee.Filter.inList(
      'ADM0_NAME',
      ['Swaziland', 'Eswatini']
    )
  );

var country = boundary.geometry();
var countryName='Eswatini';
var basinSearchArea=null;

var chirps = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR').map(function(im){return im.select('total_precipitation_sum').multiply(1000).max(0).rename('precipitation').copyProperties(im,['system:time_start']);});

var era = ee.ImageCollection(
  'ECMWF/ERA5_LAND/MONTHLY_AGGR'
);

var dem = ee.Image('USGS/SRTMGL1_003').unmask(ee.Image('NOAA/NGDC/ETOPO1').select('ice_surface').rename('elevation'), false)
  .select('elevation');

var slope = siegGlobalSlope()
  .rename('slope');

var clay = ee.Image(
  'OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02'
).select('b0');

var lc = ee.ImageCollection('ESA/WorldCover/v200')
  .first()
  .select('Map');

var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');

var s2 = ee.ImageCollection(
  'COPERNICUS/S2_SR_HARMONIZED'
);


// ================================================================
// 3. APPLICATION STATE
// ================================================================

var aoi = country;
var year = new Date().getUTCFullYear();
function hydroCutoff(date){return ee.Date(ee.Number(ee.Date(date).millis()).min(Date.now()));}
function hydroMonthCount(){
  return year===new Date().getUTCFullYear()?new Date().getUTCMonth()+1:12;
}
var activeTab = 'Water Availability';

var activeProduct;
var products;
var monthlyFC;

var generation = 0;
var dataGeneration = 0;
var areaRequest = 0;
var reservoirAreaSelected = false;
var hydraulicRequest = 0;
var hydraulicResults = null;
var opticalMonthlyFC = null;
var opticalComposite = null;
var hydraulicKind = 'dam_volume';
var selectedBasin = null;
var basinOptions = ['All intersecting sub-basins'];
var basinLabels = {};
var basinsLoaded = false;
var basinLoadError = null;
var basinLevel = '9';
var basinSourceName = 'MERIT-Basins';
var basinRequest = 0;
var publicBasins = ee.FeatureCollection('WWF/HydroSHEDS/v1/Basins/hybas_'+basinLevel)
  .filterBounds(country);
var basinData = CONFIG.basins ? ee.FeatureCollection(CONFIG.basins).filterBounds(country) : publicBasins;
var basinField = CONFIG.basins ? CONFIG.basinNameField : 'HYBAS_ID';
// Public basin IDs are not official river names or full national basin boundaries.
var analysisCaption;
var mapReadout;
var regionFeatures = {};


// ================================================================
// 4. MAP AND MAIN LAYOUT
// ================================================================

var map = ui.Map();

map.setOptions('TERRAIN');
// Country view is controlled by the country and village locator.
map.style().set('cursor', 'crosshair');

var drawing = map.drawingTools();

drawing.setShown(true);
drawing.setDrawModes(['polygon', 'rectangle']);

var sidebar = ui.Panel({
  style: {
    width: '340px',
    padding: '0px',
    backgroundColor: C.pale
  }
});

var results = ui.Panel({
  style: {
    position: 'top-right',
    width: '390px',
    padding: '12px',
    backgroundColor: C.white,
    maxHeight: '650px'
  }
});

// Report detail is retained in the DOM, but excluded from the live map.
if (results.el) { results.el.classList.add('analysis-report-only'); results.el.setAttribute('aria-hidden','true'); }

var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '12px',
    backgroundColor: C.white,
    width: '245px'
  }
});

map.add(results);
map.add(legend);

var mainSplit = ui.SplitPanel(sidebar, map, 'horizontal', false);
mainSplit.style().set('stretch', 'both');


// ================================================================
// 5. UI HELPERS
// ================================================================

function label(text, size, color) {
  return ui.Label(text, {
    fontSize: (size || 12) + 'px',
    color: color || C.ink,
    margin: '5px 0',
    whiteSpace: 'pre-wrap'
  });
}

function heading(text) {
  return label(text, 17, C.ink);
}

function note(text) {
  return label(text, 11, C.muted);
}

function button(text, callback) {
  return ui.Button({
    label: text,
    onClick: callback,
    style: {
      stretch: 'horizontal',
      color: C.teal,
      margin: '3px 0'
    }
  });
}



function addAdminBoundary() {
  map.addLayer(boundary.style({color:'808080',fillColor:'00000000',width:1}),
    {},'Administrative boundaries • grey');
}

// ================================================================
// 6. HEADER
// ================================================================

// Compact banner: fixed height, no oversized boxes or white title background.
var masthead = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    backgroundColor: '#143F73',
    stretch: 'horizontal',
    height: '54px',
    maxHeight: '54px',
    padding: '6px 14px',
    margin: '0'
  }
});
masthead.add(ui.Label('SIEG Hydrology', {
  color: '#42BBC5',
  backgroundColor: '#143F73',
  fontSize: '18px',
  fontWeight: 'bold',
  padding: '0',
  margin: '0',
  stretch: 'horizontal'
}));
masthead.add(ui.Label('CATCHMENTS • RESERVOIRS • GROUNDWATER', {
  color: '#D6E6F5',
  backgroundColor: '#143F73',
  fontSize: '10px',
  fontWeight: 'normal',
  padding: '0',
  margin: '2px 0 0 0',
  stretch: 'horizontal'
}));
ui.root.setLayout(ui.Panel.Layout.flow('vertical'));
ui.root.widgets().reset([masthead, mainSplit]);


// ================================================================
// 7. AREA AND YEAR CONTROLS
// ================================================================

var controls = ui.Panel({
  style: {
    padding: '12px',
    backgroundColor: C.white
  }
});



var regionSelect = ui.Select({
  items: [],
  placeholder: 'Select a river basin',
  style: {
    stretch: 'horizontal'
  },
  onChange: selectRegion
});

controls.add(regionSelect);

controls.add(note('Analysis year · current year runs to today'));

var yearSelect = ui.Select({
  items: Array.from({length:new Date().getUTCFullYear()-2018},function(_,i){return String(2019+i);}),
  value: String(year),
  style: {
    stretch: 'horizontal'
  },
  onChange: function(value) {
    year = Number(value);
    rebuild();
  }
});

controls.add(yearSelect);

// Avoid window.status: browsers coerce assignments to that native property into strings.
var hydroStatus = note('Loading public datasets…');

// Computation messages are displayed in the map status bar.
analysisCaption = note(countryName+' • National overview');
controls.add(button('Clear results', function() {
  generation++; hydraulicRequest++; hydraulicResults = null; activeProduct = null;
  map.layers().reset([]); results.clear(); legend.clear();
  hydroStatus.setValue('Results cleared. Select a module to display its analysis.');
}));
controls.add(analysisCaption);

sidebar.add(controls);

async function selectRegion(value) {
  var selected = value === countryName
    ? country
    : regionFeatures[value];

  if (!selected) {
    return;
  }

  aoi = selected;
  var selectionRequest=++areaRequest;
  if(window.hydroMapBridge?.area)await window.hydroMapBridge.area(selected);
  if(selectionRequest!==areaRequest)return;
  window.hydroCatchmentLimit=null;
  if(selected.siegLocalGeometry&&window.SiegAOIUpload&&window.SiegeUsage.adminMode?.()!=='unrestricted'){
    var catchmentArea=window.SiegAOIUpload.area(selected.siegLocalGeometry);
    if(catchmentArea>window.SiegAOIUpload.limitKm2('hydrology')+1e-6){
      window.hydroCatchmentLimit={areaKm2:catchmentArea};selectedBasin=null;
      analysisCaption.setValue('Complete catchment · context only');
      return;
    }
  }
  if(!await window.SiegeUsage.ensure(selected,{preview:true})||selectionRequest!==areaRequest)return;
  areaRequest++; aoi = selected; reservoirAreaSelected = false;
  selectedBasin=basinLabels.hasOwnProperty(value) ? value : null;
  analysisCaption.setValue(value+' • Area overview');window.SiegAreaSection?.ready(value+' · selected catchment');

  drawing.layers().reset([]);

  map.centerObject(aoi);

  return rebuild();
}


// ================================================================
// 8. LOAD ADMINISTRATIVE REGIONS AND OPTIONAL BASINS
// ================================================================

// Analysis Area contains basin entries only. Home resets the national view.

// Retrieve real HydroBASINS polygons; no hand-drawn or invented basin geometry.
function loadBasinOptions() {
  if(!basinSearchArea) return;
  var request=++basinRequest;
  basinsLoaded=false;basinLoadError=null;
  function populate(values,error,preferredIds) {
    if(request!==basinRequest) return;
    if(error || !values || !values.length) {
      if(!error && values && !values.length){basinsLoaded=true;basinLabels={};regionFeatures={};window.siegeHydrology?.basinsChanged([]);return;}
      basinLoadError=error || 'No nearby catchments available.';
      window.siegeHydrology?.basinsFailed(basinLoadError);
      hydroStatus.setValue('Automatic catchment lookup is unavailable. You can upload a boundary instead.');
      if(activeTab==='Basins' && window.siegeHydrology?.canAnalyse()) renderTab();
      return;
    }
    // Preserve administrative area choices and replace old basin choices.
    var oldKeys=Object.keys(basinLabels);
    var retained=[]; // Basin-only dropdown; no administrative areas.
    oldKeys.forEach(function(k) {delete regionFeatures[k];});
    basinLabels={};basinOptions=['All intersecting sub-basins'];
    values.forEach(function(value) {
      var key=basinSourceName+': '+value;
      basinLabels[key]=value;basinOptions.push(key);retained.push(key);
      regionFeatures[key]=basinData.filter(ee.Filter.eq(basinField,value)).geometry()
        ; // Preserve the complete hydrobasin, including cross-border portions.
    });
    var current=regionSelect.getValue();
    regionSelect.items().reset(retained);
    regionSelect.setValue(retained.indexOf(current)>=0 ? current : null,false);
    basinsLoaded=true;
    var preferred=(preferredIds||[]).map(function(id){return basinSourceName+': '+id;});
    window.siegeHydrology?.basinsChanged(retained,preferred);
    if(activeTab==='Basins' && window.siegeHydrology?.canAnalyse()) renderTab();
  }
  basinData.aggregate_array(basinField).distinct().sort().evaluate(function(values,error){
    if(request!==basinRequest)return;
    if(error||!values?.length||!window.basinLocationPoint){populate(values,error,[]);return;}
    basinData.filterBounds(window.basinLocationPoint).aggregate_array(basinField).distinct().sort().evaluate(function(preferred,preferredError){
      if(request!==basinRequest)return;
      populate(values,null,preferredError?[]:preferred);
    });
  });
}
// Basin lookup is started by the location selector.

// ================================================================
// 9. NAVIGATION
// ================================================================

var nav = ui.Panel({
  style: {
    padding: '10px'
  }
});

sidebar.add(nav);

var tabButtons = {};

[
  'Basins',
  'Rainfall',
  'Evapotranspiration',
  'Groundwater Recharge',
  'Surface water',
  'Water balance',
  'Turbidity',
  'Suitable Spots for Wells',
  'Demand & stress',
  'Warnings & restoration'
].forEach(function(tab, index) {
  var tabButton = button(
    ('0' + (index + 1)).slice(-2) + '  ' + tab,
    function() {
      activeTab = tab;
      renderTab();
    }
  );

  tabButtons[tab] = tabButton;

  nav.add(tabButton);
});

var modulePanel = ui.Panel({
  style: {
    padding: '12px',
    backgroundColor: C.white
  }
});

sidebar.add(modulePanel);


// ================================================================
// 10. Result requests are available through the report and task actions.

// ================================================================
// 11. DATA PROCESSING HELPERS
// ================================================================

function masked(names) {
  return ee.Image.constant(
    names.map(function() {
      return 0;
    })
  )
    .rename(names)
    .updateMask(ee.Image(0));
}

function safeMean(collection, names) {
  return ee.Image(
    ee.Algorithms.If(
      collection.size().gt(0),
      collection.select(names).mean(),
      masked(names)
    )
  );
}

function safeSum(collection, name) {
  return ee.Image(
    ee.Algorithms.If(
      collection.size().gt(0),
      collection.select(name).sum(),
      masked([name])
    )
  );
}

function maskS2(image) {
  var scl = image.select('SCL');

  var good = scl.neq(0)
    .and(scl.neq(1))
    .and(scl.neq(3))
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11));

  return image.select([
    'B2',
    'B3',
    'B4',
    'B8',
    'B11'
  ])
    .multiply(0.0001)
    .updateMask(good)
    .copyProperties(image, ['system:time_start']);
}

function indices(image) {
  var mndwi = image.expression(
    '(g - s) / (g + s)',
    {
      g: image.select('B3'),
      s: image.select('B11')
    }
  ).rename('MNDWI');

  var ndvi = image.expression(
    '(n - r) / (n + r)',
    {
      n: image.select('B8'),
      r: image.select('B4')
    }
  ).rename('NDVI');

  return image.addBands([mndwi, ndvi]);
}

function reduce(image, scale) {
  var regional=image.reduceRegion({reducer:ee.Reducer.mean(),geometry:aoi,scale:scale,maxPixels:1e8,tileScale:4});
  if(scale<1000)return regional;
  var point=image.reduceRegion({reducer:ee.Reducer.first(),geometry:aoi.centroid(100),scale:scale,maxPixels:1e6});
  var names=image.bandNames();return ee.Dictionary.fromLists(names,names.map(function(key){key=ee.String(key);var value=regional.get(key);return ee.Algorithms.If(ee.Algorithms.IsEqual(value,null),point.get(key),value);}));
}


// ================================================================
// 12. MONTHLY WATER BALANCE
// ================================================================

function makeMonthly() {
  return ee.FeatureCollection(
    ee.List.sequence(1, hydroMonthCount()).map(function(month) {
      var start = ee.Date.fromYMD(year, month, 1);

      var end = hydroCutoff(start.advance(1, 'month'));

      var rainfall = safeSum(
        chirps.filterDate(start, end),
        'precipitation'
      ).rename('rainfall_mm');

      var climate = safeMean(
        era.filterDate(start, end),
        [
          'total_evaporation_sum',
          'runoff_sum',
          'volumetric_soil_water_layer_1'
        ]
      );

      // ERA evaporation follows the negative upward-flux convention.
      // Convert metres to millimetres and reverse its sign.
      var et = climate
        .select('total_evaporation_sum')
        .multiply(-1000)
        .max(0)
        .rename('ET_mm');

      var runoff = climate
        .select('runoff_sum')
        .multiply(1000)
        .max(0)
        .rename('runoff_mm');

      var soilMoisture = climate
        .select('volumetric_soil_water_layer_1')
        .rename('soil_moisture');

      // Climatic balance excludes runoff and storage changes.
      // It must not be interpreted as groundwater recharge.
      var balance = rainfall.subtract(et)
        .rename('balance_mm');

      var statistics = reduce(
        rainfall.addBands([
          et,
          runoff,
          soilMoisture,
          balance
        ]),
        11132
      );

      return ee.Feature(null, statistics).set({
        date: start.format('YYYY-MM'),
        'system:time_start': start.millis()
      });
    })
  );
}


// ================================================================
// 13. BUILD ANALYSIS PRODUCTS
// ================================================================

async function rebuild() {
  if(window.SiegeUsage?.active?.freeRestoration)return hydroPreviewRestoration();
  if(window.SiegeUsage){if(!await window.SiegeUsage.ensure(aoi,{preview:true}))return;if(!window.SiegeUsage.canProcess()){map.layers().reset([]);results.clear();legend.clear();products=null;window.activeProduct=null;window.siegeHydrology?.analysisChanged(selectedBasin);hydroStatus.setValue('Boundary preview ready. Choose a task and pay before analysis.');return;}}
  window.SiegeUsage?.setType?.('Catchment preparation');
  window.siegeHydrology?.analysisChanged(selectedBasin);
  generation++; dataGeneration++; hydraulicRequest++; hydraulicResults = null; opticalMonthlyFC = null;

  hydroStatus.setValue(
    'Preparing ' + year + ' analysis…'
  );

  var start = ee.Date.fromYMD(year, 1, 1);
  var end = hydroCutoff(start.advance(1, 'year'));

  var annualRain = safeSum(
    chirps.filterDate(start, end),
    'precipitation'
  ).rename('rainfall');

  var climateCollection = era.filterDate(start, end);

  var annualET = safeSum(
    climateCollection,
    'total_evaporation_sum'
  )
    .multiply(-1000)
    .max(0)
    .rename('ET');

  var runoff = safeSum(
    climateCollection,
    'runoff_sum'
  )
    .multiply(1000)
    .max(0)
    .rename('runoff');

  var moisture = safeMean(
    climateCollection,
    ['volumetric_soil_water_layer_1']
  ).rename('moisture');

  var balance = annualRain.subtract(annualET)
    .rename('balance');

  // Long-term annual rainfall baseline.
  var baseline = ee.ImageCollection.fromImages(
    ee.List.sequence(1991, 2020).map(function(y) {
      var date = ee.Date.fromYMD(y, 1, 1);

      return chirps
        .filterDate(date, year===new Date().getUTCFullYear()?date.advance(new Date().getUTCMonth(),'month').advance(new Date().getUTCDate(),'day'):date.advance(1,'year'))
        .sum()
        .rename('p');
    })
  ).mean();

  var anomaly = annualRain.subtract(baseline)
    .divide(baseline)
    .multiply(100)
    .rename('anomaly');

  // Selected-year optical data.
  var optical = s2
    .filterBounds(aoi)
    .filterDate(start, end)
    .filter(
      ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80)
    )
    .map(maskS2)
    .map(indices);

  var composite = safeMean(
    optical,
    [
      'B2',
      'B3',
      'B4',
      'B8',
      'B11',
      'MNDWI',
      'NDVI'
    ]
  );

  opticalComposite = composite;
  var water = composite.select('MNDWI')
    .gt(0.15)
    .and(composite.select('NDVI').lt(0.2))
    .rename('water');

  // ------------------------------------------------------------
  // Surface recharge screening index.
  //
  // Rainfall: 35%
  // Slope: 25%
  // Surface clay: 25%
  // Land cover: 15%
  //
  // Fixed heuristic weights; no local calibration.
  // Geology, fractures and aquifer properties are not included.
  // ------------------------------------------------------------

  var rainScore = annualRain
    .unitScale(400, 1400)
    .clamp(0, 1);

  var slopeScore = ee.Image(1).subtract(
    slope.divide(20).clamp(0, 1)
  );

  var soilScore = ee.Image(1).subtract(
    clay.divide(60).clamp(0, 1)
  );

  var coverScore = lc.remap(
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100],
    [0.75, 0.8, 0.85, 0.65, 0.1, 0.45, 0.1, 0, 0.7, 0.7, 0.5]
  ).rename('cover');

  var rechargeIndex = rainScore.multiply(0.35)
    .add(slopeScore.multiply(0.25))
    .add(soilScore.multiply(0.25))
    .add(coverScore.multiply(0.15))
    .multiply(100)
    .updateMask(lc.neq(80))
    .rename('index');

  var built = lc.eq(50).rename('built');

  var crops = lc.eq(40).rename('crops');

  var restoration = rechargeIndex.gte(60)
    .and(lc.eq(60).or(lc.eq(40)))
    .selfMask()
    .rename('priority');

  var ndti = composite.expression(
    '(r - g) / (r + g)',
    {
      r: composite.select('B4'),
      g: composite.select('B3')
    }
  )
    .updateMask(water)
    .rename('NDTI');

  products = {};

  function add(
    key,
    title,
    image,
    min,
    max,
    palette,
    scale,
    description
  ) {
    products[key] = {
      key: key,
      title: title,
      image: image,
      min: min,
      max: max,
      palette: palette,
      scale: scale,
      description: description
    };
  }

  add(
    'recharge',
    'Surface recharge favourability (0–100)',
    rechargeIndex,
    0,
    100,
    hydroPalette,
    1000,
    'Uncalibrated screening: rainfall 35%, slope 25%, ' +
    'surface clay 25%, land cover 15%. Missing geology ' +
    'and fracture data. Fine map pixels do not imply ' +
    'fine rainfall information.'
  );

  add(
    'clay',
    'Surface clay content (%)',
    clay,
    0,
    60,
    ['F3EDE1', 'D4C4A9', '9B805A'],
    250,
    'OpenLandMap modelled surface clay, 250 m. ' +
    'Soil texture does not establish aquifer permeability.'
  );

  add(
    'slope',
    'Terrain slope (degrees)',
    slope,
    0,
    35,
    ['F3EDE1', 'D2E2F1', '6C9EC9', '123D71'],
    90,
    'SRTM terrain with coarse ETOPO1 fallback outside SRTM coverage. ' +
    'Slope is shown in degrees, not percent.'
  );

  add(
    'rain',
    (year===new Date().getUTCFullYear()?'Year-to-date rainfall (mm)':'Annual rainfall (mm)'),
    annualRain,
    0,
    1800,
    hydroPalette,
    5566,
    'ERA5-Land precipitation requested-period rainfall total; approximately 11 km grid. Current year is year to date. Small boundaries use centroid-cell regional context if the area mean is unavailable.'
  );

  add(
    'et',
    (year===new Date().getUTCFullYear()?'Year-to-date evapotranspiration (mm)':'Annual evapotranspiration (mm)'),
    annualET,
    0,
    1400,
    hydroPalette,
    11132,
    'ERA5-Land total evaporation sign reversed and ' +
    'converted from metres to millimetres. ' +
    'Modelled, approximately 11 km.'
  );

  add(
    'balance',
    (year===new Date().getUTCFullYear()?'Year-to-date climatic balance P − ET (mm)':'Annual climatic balance P − ET (mm)'),
    balance,
    -600,
    600,
    diverge,
    11132,
    'ERA5-Land precipitation rainfall minus ERA5-Land ET. Excludes ' +
    'storage change and runoff. This is not recharge ' +
    'or available abstraction.'
  );

  add(
    'runoff',
    (year===new Date().getUTCFullYear()?'Year-to-date modelled runoff (mm)':'Annual modelled runoff (mm)'),
    runoff,
    0,
    600,
    hydroPalette,
    11132,
    'ERA5-Land total runoff depth. ' +
    'Not measured river discharge.'
  );

  add(
    'moisture',
    'Mean topsoil moisture (m³/m³)',
    moisture,
    0.05,
    0.45,
    hydroPalette,
    11132,
    'ERA5-Land mean volumetric moisture, 0–7 cm layer. ' +
    'Not groundwater storage.'
  );

  add(
    'water',
    'Optical water screening mask',
    water.selfMask(),
    0,
    1,
    ['188BB6', '188BB6'],
    20,
    'Annual mean Sentinel-2 MNDWI > 0.15 and NDVI < 0.2. ' +
    'Cloud-masked optical screening; may miss narrow or ' +
    'seasonal water and confuse shadows. ' +
    'Not reservoir capacity.'
  );

  add(
    'occurrence',
    'Historical water occurrence (%)',
    gsw.select('occurrence'),
    0,
    100,
    hydroPalette,
    30,
    'JRC Landsat historical water occurrence, 1984–2021. ' +
    'Does not change with the selected year.'
  );

  add(
    'seasonality',
    'Historical water seasonality (months)',
    gsw.select('seasonality'),
    0,
    12,
    hydroPalette,
    30,
    'JRC number of months with water in 2021. ' +
    'Static reference layer.'
  );

  add(
    'ndti',
    'Optical turbidity proxy (NDTI)',
    ndti,
    -0.3,
    0.4,
    ['2166AC', 'D6E8CC', 'C3A064', '8C510A'],
    20,
    'Uncalibrated red/green index over the screening ' +
    'water mask. Not NTU, chemistry, bacterial ' +
    'contamination or drinking-water safety.'
  );

  add(
    'built',
    'Built-up land • 2021',
    built.selfMask(),
    0,
    1,
    ['C26855', 'C26855'],
    10,
    'ESA WorldCover 2021 settlement footprint. ' +
    'Not population, abstraction or consumption.'
  );

  add(
    'crops',
    'Cropland • 2021',
    crops.selfMask(),
    0,
    1,
    ['E2B94B', 'E2B94B'],
    10,
    'ESA WorldCover 2021 cropland. ' +
    'Irrigation status and demand are unknown.'
  );

  add(
    'anomaly',
    'Rainfall departure from 1991–2020 (%)',
    anomaly,
    -60,
    60,
    diverge,
    5566,
    'Rainfall anomaly for the matched calendar window. Negative means drier ' +
    'than baseline. Not a forecast or a standardized ' +
    'drought index.'
  );

  add(
    'restoration',
    'Candidate infiltration restoration areas',
    restoration,
    0,
    1,
    ['256EB3', '256EB3'],
    1000,
    'Heuristic: surface recharge index ≥60 and 2021 ' +
    'cropland/bare land. Verify land tenure, soils, ' +
    'groundwater quality and ecological suitability ' +
    'before intervention.'
  );

  monthlyFC = makeMonthly();

  renderTab();

  var token = dataGeneration;
  var analysisYear = year;

  ee.Dictionary({
    eraMonths: climateCollection.size(),
    rainDays: chirps.filterDate(start, end).size(),
    latestRain:chirps.filterDate(start,end).aggregate_max('system:time_start'),
    latestClimate:climateCollection.aggregate_max('system:time_start'),
    opticalImages: optical.size()
  }).evaluate(function(values, error) {
    if (token !== dataGeneration) {
      return;
    }

    if (error) {
      hydroStatus.setValue('Data error: ' + error);
      return;
    }

    hydroStatus.setValue(
      analysisYear +
      ' • ERA months: ' + values.eraMonths + '/'+hydroMonthCount() +
      ' • rainfall days: ' + values.rainDays +
      ' • optical scenes: ' + values.opticalImages +
      ' | Rain latest: '+(values.latestRain?new Date(values.latestRain).toISOString().slice(0,10):'unavailable')+
      ' | ERA latest: '+(values.latestClimate?new Date(values.latestClimate).toISOString().slice(0,10):'unavailable')+
      (
        values.eraMonths < hydroMonthCount()
          ? '\nPartial period / provider publication lag; no future data are filled.'
          : ''
      )
    );
  });
}


// ================================================================
// 14. MODULE DEFINITIONS
// ================================================================

var tabs = {
  'Flood-risk Screening':['water','anomaly','slope'],
  'Water Availability':['water','occurrence','seasonality','rain'],
  'Water Balance':['balance','rain','et','runoff','moisture'],
  'Drought':['anomaly','moisture','balance'],
  'Flood Watch':['anomaly','water','slope'],
  'Catchment Health':['ndti','restoration','recharge','clay','slope','built','crops'],
  'Rainfall': ['rain','anomaly'],
  'Water balance': ['balance','rain','et','runoff','moisture'],
  'Evapotranspiration': ['et','balance'],
  'Groundwater Recharge': ['recharge','clay','slope','balance'],
  'Surface water': ['water','occurrence','seasonality'],
  'Flood watch': ['anomaly','water','slope'],
  'Turbidity': ['ndti','water'],
  'Demand & stress': ['balance','built','crops'],
  'Warnings & restoration': ['anomaly','restoration','slope']
};
var messages = {
  'Flood-risk Screening':'Preliminary exposure screening using mapped surface water, rainfall departure and slope. These are separate screening indicators, not a predicted flood extent, depth, forecast or certified floodline. Request a reviewed report for interpretation and next steps.',
  'Water Availability':'Observe water extent and rainfall. Estimate river flow or reservoir storage using the hydraulic tools.',
  'Water Balance':'Rainfall, modelled losses and runoff. P − ET is a climatic balance, not a closed water budget or aquifer recharge.',
  'Drought':'Retrospective rainfall departure and modelled moisture. These are not forecasts or validated drought severity classes.',
  'Flood Watch':'Use the input panel below. Choose River or Dam, then Manual scenario or Timestamped gauge CSV. All times are UTC.',
  'Catchment Health':'Optical water-quality proxies, land cover and restoration screening. Surface recharge scores are screening indicators, not measured recharge.',
  'Water balance': 'Compare rainfall, atmospheric losses and modelled runoff. Climatic balance P − ET excludes storage changes and is not recharge. Additional storage and flow tools are available below.',
  'Rainfall': 'Rainfall supply and departure from the 1991–2020 baseline.',
  'Evapotranspiration': 'Modelled atmospheric water loss and climatic balance.',
  'Groundwater Recharge': 'Surface recharge favourability. Quantitative aquifer recharge needs a calibrated model and field evidence.',
  'Surface water': 'Selected-year optical water screening and historical persistence.',
  'Flood watch': 'Review rainfall anomaly, mapped surface water and slope within your analysis area. Selected-year screening only; not live flood alerts or a flood forecast.',
  'Turbidity': 'Optical screening over mapped water. NDTI is not measured NTU or drinking-water safety.',
  'Suitable Spots for Wells': 'Screen areas for further investigation. Confirm geology, fractures, contamination setbacks, drilling access and measured yields.',
  'Demand & stress': 'Climatic deficit, settlement and cropland footprints. Water consumption and abstraction records are not supplied.',
  'Warnings & restoration': 'Retrospective rainfall anomaly and candidate infiltration restoration. These indicators do not forecast incoming disasters.'
};

// ================================================================
// 15. RENDER SELECTED MODULE
// ================================================================

async function renderTab() {
  if(window.SiegeUsage?.active?.freeRestoration&&activeTab==='Catchment Health')return hydroPreviewRestoration();
  var requestedTab = activeTab;
  var tabGeneration = ++generation;
  results.clear();
  if(window.SiegeUsage && !await window.SiegeUsage.ensure(aoi))return;
  if (requestedTab !== activeTab || tabGeneration !== generation) return;
  window.SiegeUsage?.setType?.(requestedTab);
  if (!products) {
    return;
  }

  Object.keys(tabButtons).forEach(function(tab) {
    tabButtons[tab].style().set({
      backgroundColor:
        tab === activeTab ? '#DCE9F7' : C.white,

      fontWeight:
        tab === activeTab ? 'bold' : 'normal'
    });
  });

  hydraulicRequest++; hydraulicResults = null;
  if (activeTab === 'Wetland Mapping') {window.HydroWetlands?.clear();activeProduct=null;legend.clear();modulePanel.clear();modulePanel.add(heading('Wetland Mapping'));results.add(note('Area or year changed. Use 04 / Wetland Mapping to run screening for the current catchment.'));return;}
  if (activeTab === 'Basins') {renderBasins(); return;}
  modulePanel.clear();

  modulePanel.add(heading(activeTab));

  modulePanel.add(note(messages[activeTab]));
  if(activeTab==='Flood Watch') {
    activeProduct=null;legend.clear();map.layers().reset([]);
    results.add(note('Choose River or Dam in Flood Watch inputs, enter measurements or upload a timed CSV, then calculate.'));
    return;
  }
  if (['Water balance','Water Balance','Water Availability','Flood Watch'].indexOf(activeTab)>=0) addBalanceMode('Maps & charts');

  var keys = tabs[activeTab];

  var choices = keys.map(function(key) {
    return products[key].title;
  });

  var selector = ui.Select({
    items: choices,
    placeholder: 'Choose a layer…',
    value: '',

    style: {
      stretch: 'horizontal'
    },

    onChange: function(value) {
      showProduct(
        keys[choices.indexOf(value)]
      );
    }
  });

  modulePanel.add(selector);

  if (activeTab === 'Suitable Spots for Wells' || activeTab === 'Catchment Health') {
    modulePanel.add(
      note(
        CONFIG.boreholes
          ? 'Borehole markers loaded. Click near a marker ' +
            'to inspect measured records.'
          : 'No measured borehole records supplied. Add an ' +
            'imported FeatureCollection to CONFIG.boreholes ' +
            'to show monitoring sites.'
      )
    );
  }

  results.add(note('Select an indicator in the Layers panel. No map allowance is used until you choose a layer.'));
}


// ================================================================
// 16. DISPLAY MAP, LEGEND, SUMMARY AND CHARTS
// ================================================================

function showProduct(key) {
  activeProduct = products[key];

  var product = activeProduct;

  product.evidence = hydroEvidence(key);
  product.generatedAt = new Date().toISOString();
  map.layers().reset([]);
  if(!window.SiegeUsage?.active?.freeTrial)addAdminBoundary();

  map.addLayer(
    product.image.clip(aoi),
    {
      min: product.min,
      max: product.max,
      palette: product.palette
    },
    product.title
  );

  // Transparent fill and visible outline.
  map.addLayer(
    ee.FeatureCollection([
      ee.Feature(aoi)
    ]).style({
      color: '256EB3',
      fillColor: '00000000',
      width: 2
    }),
    {},
    'Analysis outline'
  );

  if (
    activeTab === 'Suitable Spots for Wells' &&
    CONFIG.boreholes
  ) {
    map.addLayer(
      CONFIG.boreholes.filterBounds(aoi).style({
        color: 'FFCB66',
        pointSize: 6
      }),
      {},
      'Measured boreholes'
    );
  }

  // ------------------------------------------------------------
  // Legend
  // ------------------------------------------------------------

  legend.clear();

  legend.style().set('width','320px');
  legend.add({el: window.SiegLegend.create({title:product.title,palette:product.palette,min:product.min,max:product.max})});
  window.SiegHoverInspector?.setLegend(window.SiegReportMap,{title:product.title,palette:product.palette,min:product.min,max:product.max,units:product.units||''});

  legend.add(
    note('Analysis grid: ' + product.scale + ' m')
  );

  // ------------------------------------------------------------
  // Results
  // ------------------------------------------------------------

  results.clear();

  results.add(
    heading(activeTab + ' • ' + year)
  );

  results.add(note(product.evidence.kind+' • '+product.evidence.unit));
  results.add(note('Period: '+product.evidence.period+' | Baseline: '+product.evidence.baseline));
  results.add(note('Source: '+product.evidence.source+' | Analysis grid: '+product.scale+' m'));
  results.add(note('Computed: '+product.generatedAt+' | Latest observations shown in the map status bar; not real-time'));
  results.add(note(product.evidence.limit));
  var card = label(
    'Calculating area summary…',
    13,
    C.teal
  );

  results.add(card);

  var token = ++generation;

  var areaKeys = [
    'water',
    'built',
    'crops',
    'restoration'
  ];

  var isArea = areaKeys.indexOf(key) >= 0;

  var statistic;

  if (isArea) {
    statistic = product.image
      .unmask(0)
      .multiply(ee.Image.pixelArea())
      .divide(1e6)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: Math.max(product.scale, reservoirAreaSelected ? 20 : 100),
        crs: 'EPSG:4326',
        maxPixels: 1e8,
        tileScale: 4
      });
  } else {
    statistic = reduce(
      product.image,
      product.scale
    );
  }

  statistic.evaluate(function(values, error) {
    if (token !== generation) {
      return;
    }

    if (error) {
      card.setValue(
        'Summary unavailable: ' + error
      );
      return;
    }

    var numbers = values
      ? Object.keys(values).map(function(name) {
          return values[name];
        })
      : [];

    var value = numbers.length
      ? numbers[0]
      : null;

    if (value === null || value === undefined) {
      card.setValue(
        'No valid observations in this area.'
      );
      return;
    }

    card.setValue(
      isArea
        ? 'Approx. mapped area: ' + value.toFixed(2) + ' km²'
        : 'Area mean: ' + value.toFixed(2)+' '+product.evidence.unit
    );
    window.HydroDeliverReport?.();
  });

  // ------------------------------------------------------------
  // Monthly rainfall and ET chart
  // ------------------------------------------------------------

  renderModuleCharts();


}


// ================================================================
// 17. OPTIONAL BOREHOLE INSPECTION
// ================================================================

map.onClick(function(coords) {
  if (
    (activeTab !== 'Suitable Spots for Wells' && ['Water balance','Water Balance','Water Availability','Flood Watch'].indexOf(activeTab)<0) ||
    !CONFIG.boreholes
  ) {
    return;
  }

  var point = ee.Geometry.Point([
    coords.lon,
    coords.lat
  ]);

  var sites = CONFIG.boreholes
    .filterBounds(aoi)
    .filterBounds(point.buffer(1000));

  var token = generation;

  sites.limit(5).evaluate(function(collection, error) {
    if (token !== generation) {
      return;
    }

    results.clear();

    results.add(
      heading('Borehole records • within 1 km')
    );

    if (
      error ||
      !collection ||
      !collection.features.length
    ) {
      results.add(
        note('No monitoring records near this location.')
      );
      return;
    }

    collection.features.forEach(function(feature) {
      var properties = feature.properties;

      results.add(
        label(
          properties.name || 'Unnamed monitoring site',
          14,
          C.teal
        )
      );

      var depth = properties.water_level_m == null
        ? 'not supplied'
        : properties.water_level_m + ' m';

      var yieldValue = properties.yield_lps == null
        ? 'not supplied'
        : properties.yield_lps + ' L/s';

      results.add(
        note(
          'Water depth below ground: ' + depth +
          '\nMeasured yield: ' + yieldValue
        )
      );
    });
  });
});


// ================================================================
// 18. START DASHBOARD
// ================================================================


// ================================================================
// DAM VOLUME AND RIVER DISCHARGE — ADDITIONAL MODULES
// ================================================================
function hydraulicField(title, placeholder, initial) {
  modulePanel.add(note(title));
  var box = ui.Textbox({placeholder: placeholder, value: initial || '',
    style: {stretch: 'horizontal'}});
  box.onChange(function() {hydraulicRequest++; hydraulicResults = null;
    hydroStatus.setValue('Inputs changed. Recalculate before requesting a report.');});
  modulePanel.add(box); return box;
}
function readNumber(box, title, minimum, inclusive) {
  var raw = String(box.getValue()).trim();
  var value = Number(raw);
  if (!raw || !isFinite(value) || (inclusive ? value < minimum : value <= minimum)) {
    throw new Error(title+' must be '+(inclusive ? 'at least ' : 'greater than ')+minimum+'.');
  }
  return value;
}
function exportHydraulics() {
  document.getElementById('requestHydrologyReport').click();
}

function resetHydraulicView(title) {
  ++generation; modulePanel.clear(); results.clear(); legend.clear();
  modulePanel.add(heading(title)); results.add(heading(title));
  map.layers().reset([]); activeProduct = null; addAdminBoundary();
  map.addLayer(ee.FeatureCollection([ee.Feature(aoi)]).style({color:'256EB3',
    fillColor:'00000000',width:2}),{},'Analysis outline');
}

// SI Manning equation. z = horizontal:vertical side slope on BOTH banks.
// z=0 yields a rectangular section. b is BOTTOM width, y is water depth.
function estimateManningFlow(b, y, z, slopeMperM, n) {
  if (!(b > 0 && y > 0 && z >= 0 && slopeMperM > 0 && n > 0)) {
    throw new Error('Invalid Manning inputs.');
  }
  var area = y*(b+z*y);
  var perimeter = b+2*y*Math.sqrt(1+z*z);
  var radius = area/perimeter;
  var velocity = Math.pow(radius,2/3)*Math.sqrt(slopeMperM)/n;
  return {area:area,perimeter:perimeter,radius:radius,
    velocity:velocity,discharge:area*velocity,topWidth:b+2*z*y};
}

// Integrates max(water-surface elevation - surveyed bed elevation, 0)
// over the selected reservoir outline. CRS and scale are explicit.
function estimateBathymetricVolume(bedImage, level, region, scale) {
  var bed = ee.Image(bedImage).select([0]).rename('bed');
  var depth = bed.multiply(-1).add(level).max(0).rename('depth_m');
  var area = ee.Image.pixelArea();
  var volume = depth.multiply(area).rename('volume_m3');
  var wetArea = area.updateMask(depth.gt(0)).rename('wet_area_m2');
  var covered = area.updateMask(bed.mask()).rename('covered_m2');
  var stats = volume.addBands([wetArea,covered]).reduceRegion({
    reducer:ee.Reducer.sum(),geometry:region,crs:bed.projection(),scale:scale,
    maxPixels:1e8,tileScale:4});
  return {depth:depth,stats:stats};
}

function renderDamVolume() {
  resetHydraulicView('Reservoir storage / capacity estimate');
  hydraulicKind='dam_volume'; addBalanceMode('Dam volume');
  modulePanel.add(note('Draw and analyse a polygon enclosing ONE reservoir. '+
    'Use mean depth for the same water level/date as the water area. '+
    'Maximum depth cannot replace mean depth. MSL alone is insufficient: supply a measured mean bed elevation or surveyed bathymetry in the same datum. Full capacity requires full-supply area and depth.'));
  var mode = ui.Select({items:['Water area × mean depth','MSL water level − mean bed elevation','Surveyed bathymetry + water level'],
    value:'Water area × mean depth',style:{stretch:'horizontal'}});
  modulePanel.add(mode);
  var target=ui.Select({items:['Storage at entered water level','Full-supply capacity (full-supply inputs only)'],value:'Storage at entered water level',style:{stretch:'horizontal'}});
  modulePanel.add(target);
  var month = ui.Select({items:Array.from({length:hydroMonthCount()},function(_,i){return String(i+1).padStart(2,'0');}),
    value:String(hydroMonthCount()).padStart(2,'0'),style:{stretch:'horizontal'}});
  modulePanel.add(note('OPTICAL OBSERVATION MONTH IN SELECTED YEAR')); modulePanel.add(month);
  var meanDepth = hydraulicField('MEAN WATER DEPTH (m)','Required for area method');
  var manualArea = hydraulicField('OPTIONAL SURVEYED WATER AREA (hectares)',
    'Leave empty to estimate from Sentinel-2');
  var meanBed = hydraulicField('MEASURED MEAN BED ELEVATION (m above MSL)','Same vertical datum as water level');
  var level = hydraulicField('WATER-SURFACE ELEVATION (m above MSL / bed datum)',
    'Required for bathymetry method');
  function invalidate() {hydraulicRequest++; hydraulicResults = null;}
  mode.onChange(invalidate); month.onChange(invalidate); target.onChange(invalidate);
  modulePanel.add(button('Estimate reservoir volume',function() {
    var token = ++hydraulicRequest; hydraulicResults = null;
    results.clear(); results.add(heading('Reservoir volume estimate'));
    var method = mode.getValue();
    if (method === 'Surveyed bathymetry + water level') {
      if (!reservoirAreaSelected) {results.add(note('Draw and analyse one reservoir polygon first.')); return;}
      if (!CONFIG.bathymetry) {results.add(note('Import a surveyed bed-elevation image and set CONFIG.bathymetry. '+
        'Its vertical datum must match the entered water level. SRTM over existing water does not provide the reservoir floor.')); return;}
      var stage;
      try {stage = readNumber(level,'Water level',-12000,true);} catch(err) {results.add(note(err.message)); return;}
      var bathyScale = Number(CONFIG.bathymetryScale);
      if (!(bathyScale > 0)) {results.add(note('CONFIG.bathymetryScale must be positive.')); return;}
      var calc = estimateBathymetricVolume(CONFIG.bathymetry,stage,aoi,bathyScale);
      results.add(note('Integrating surveyed reservoir bed…'));
      ee.Dictionary({stats:calc.stats,outline_m2:aoi.area(1)}).evaluate(function(v,error) {
        if (token !== hydraulicRequest || ['Water balance','Water Balance','Water Availability','Flood Watch'].indexOf(activeTab)<0) return;
        results.clear(); results.add(heading('Bathymetric volume estimate'));
        if (error || !v) {results.add(note('Calculation unavailable: '+error)); return;}
        var st = v.stats, covered = Number(st.covered_m2 || 0);
        var coverage = covered/v.outline_m2;
        if (coverage < 0.95) {results.add(note('Bathymetry covers only '+(coverage*100).toFixed(1)+
          '% of the outline. Supply complete bed data or tighten the reservoir outline; no total volume reported.')); return;}
        var volume = Number(st.volume_m3 || 0), area = Number(st.wet_area_m2 || 0);
        results.add(label((target.getValue().indexOf('Full-supply')===0?'Estimated capacity: ':'Estimated storage: ')+volume.toFixed(0)+' m³',18,C.teal));
        results.add(label((volume/1e6).toFixed(3)+' million m³',16,C.ink));
        results.add(note('Wet area: '+(area/10000).toFixed(2)+' ha\nWater level: '+stage+' m\n'+
          'Mean computed depth: '+(area ? volume/area : 0).toFixed(2)+' m\n'+
          'Bathymetry coverage: '+(coverage*100).toFixed(1)+'%'));
        results.add(note('Volume is integrated only where bed data exist. '+
          'The outline must isolate the hydraulically connected reservoir. '+
          'This is storage at the entered stage, not full-supply capacity unless that stage is full supply.'));
        map.layers().reset([]); addAdminBoundary();
        map.addLayer(calc.depth.updateMask(calc.depth.gt(0)).clip(aoi),
          {min:0,max:30,palette:hydroPalette},'Bathymetric water depth (m)');
        map.addLayer(ee.FeatureCollection([ee.Feature(aoi)]).style({color:'256EB3',
          fillColor:'00000000',width:2}),{},'Reservoir outline');
        legend.clear(); legend.add({el:window.SiegLegend.create({title:'Bathymetric depth (m)',min:0,max:30,palette:hydroPalette,meaning:'Values above 30 m use the darkest colour.'})});
        activeProduct = {key:'dam_depth',image:calc.depth,scale:bathyScale};
        hydraulicResults = ee.FeatureCollection([ee.Feature(null,{method:'surveyed_bathymetry',
          estimate_target:target.getValue(),water_level_m:stage,volume_m3:volume,wet_area_m2:area,coverage_fraction:coverage,
          outline_area_m2:v.outline_m2,scale_m:bathyScale})]);
      }); return;
    }
    var depth, enteredArea;
    try {
      if(method==='MSL water level − mean bed elevation') {
        var stageValue=readNumber(level,'Water-surface elevation',-12000,true);
        var bedValue=readNumber(meanBed,'Mean bed elevation',-12000,true);
        depth=stageValue-bedValue;
        if(!(depth>0))throw Error('Water level must exceed the measured mean bed elevation.');
      } else depth = readNumber(meanDepth,'Mean depth',0,false);
      enteredArea = String(manualArea.getValue()).trim() ?
        readNumber(manualArea,'Water area',0,false)*10000 : null;
    } catch(err) {results.add(note(err.message)); return;}
    function report(area, source, validFraction, period) {
      if (token !== hydraulicRequest || ['Water balance','Water Balance','Water Availability','Flood Watch'].indexOf(activeTab)<0) return;
      results.clear(); results.add(heading('Model estimate • Area × mean depth'));
      if (!(area > 0)) {results.add(note('No water mapped. Check month, clouds, polygon and threshold.')); return;}
      var volume = area*depth;
      results.add(label((target.getValue().indexOf('Full-supply')===0?'Estimated capacity: ':'Estimated storage: ')+volume.toFixed(0)+' m³',18,C.teal));
      results.add(label((volume/1e6).toFixed(3)+' million m³',16,C.ink));
      results.add(note('Water area: '+(area/10000).toFixed(2)+' ha\nEntered mean depth: '+depth+' m\n'+
        'Method: '+method+'\nArea source: '+source+(period ? '\nOptical period: '+period : '')+
        (validFraction == null ? '' : '\nValid optical coverage: '+(validFraction*100).toFixed(1)+'%')));
      results.add(note('V = water area × entered mean depth. '+
        'Storage changes if either input changes. This is not automatically dam capacity. '+
        'The optical method uses a monthly composite, not an instantaneous shoreline.'));
      var sensitivity = ee.FeatureCollection([0.75,1,1.25].map(function(f) {
        return ee.Feature(null,{mean_depth_m:depth*f,volume_m3:area*depth*f});
      }));
      results.add(ui.Chart.feature.byFeature(sensitivity,'mean_depth_m',['volume_m3'])
        .setOptions({title:'Depth scenarios (±25%, not confidence limits)',
          colors:[C.teal],legend:{position:'none'},hAxis:{title:'Mean depth (m)'},
          vAxis:{title:'Volume (m³)'},height:200}));
      hydraulicResults = ee.FeatureCollection([ee.Feature(null,{method:'area_times_mean_depth',
        estimate_target:target.getValue(),area_source:source,period:period || 'user_supplied',area_m2:area,input_mode:method,
        evidence:'Model estimate / user-supplied geometry and depths',
        mean_depth_m:depth,volume_m3:volume,valid_optical_fraction:validFraction})]);
    }
    if (enteredArea !== null) {report(enteredArea,'user supplied',null,null); return;}
    if (!reservoirAreaSelected) {results.add(note('Draw and analyse ONE reservoir polygon, '+
      'or enter a surveyed water area in hectares.')); return;}
    var d = ee.Date.fromYMD(year,Number(month.getValue()),1);
    var obs = s2.filterBounds(aoi).filterDate(d,hydroCutoff(d.advance(1,'month')))
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',80)).map(maskS2).map(indices);
    var comp = safeMean(obs,['MNDWI','NDVI']);
    var wet = comp.select('MNDWI').gt(0.15).and(comp.select('NDVI').lt(0.2));
    var px = ee.Image.pixelArea();
    var stats = px.updateMask(wet).rename('water_m2')
      .addBands(px.updateMask(comp.select('MNDWI').mask()).rename('valid_m2'))
      .reduceRegion({reducer:ee.Reducer.sum(),geometry:aoi,scale:20,
        crs:'EPSG:4326',maxPixels:1e8,tileScale:4});
    results.add(note('Mapping water for '+year+'-'+month.getValue()+'…'));
    var period = year+'-'+month.getValue();
    ee.Dictionary({stats:stats,outline_m2:aoi.area(1),scene_count:obs.size()}).evaluate(function(v,error) {
      if (token !== hydraulicRequest || ['Water balance','Water Balance','Water Availability','Flood Watch'].indexOf(activeTab)<0) return;
      if (error || !v) {results.add(note('Water mapping unavailable: '+error)); return;}
      var coverage = Number(v.stats.valid_m2 || 0)/v.outline_m2;
      if (!v.scene_count || coverage < 0.9) {
        results.clear(); results.add(note('Insufficient valid optical coverage ('+(coverage*100).toFixed(1)+
          '%). Select another month or enter a surveyed area. No volume reported.')); return;
      }
      report(Number(v.stats.water_m2 || 0),'Sentinel-2 monthly water mask',coverage,period);
      map.layers().reset([]); addAdminBoundary();
      map.addLayer(wet.selfMask().clip(aoi),{palette:['188BB6']},'Reservoir water '+period);
      map.addLayer(ee.FeatureCollection([ee.Feature(aoi)]).style({color:'256EB3',
        fillColor:'00000000',width:2}),{},'Reservoir outline');
      activeProduct = {key:'dam_water',image:wet,scale:20};
      legend.clear(); legend.add({el:window.SiegLegend.create({title:'Optical water screening',items:[{label:'Potential water',color:'#188BB6'}],meaning:'MNDWI > 0.15 and NDVI < 0.2. '+period})});
    });
  }));

  results.add(note('Choose a method, enter measured or explicit scenario inputs, then calculate.'));
}

function renderRiverFlow() {
  resetHydraulicView('Water balance • Manning estimate');
  hydraulicKind='river_flow'; addBalanceMode('River discharge');
  modulePanel.add(note('Manning equation for steady, approximately uniform open-channel flow. '+
    'Enter a representative surveyed cross-section and energy slope. '+
    'The selected map polygon does not determine river discharge.'));
  var b = hydraulicField('BOTTOM CHANNEL WIDTH (m)','e.g. 12');
  var y = hydraulicField('OPTIONAL WATER DEPTH (m)','Leave blank only when area and hydraulic radius are known');
  var measuredArea=hydraulicField('CROSS-SECTION AREA (m²; alternative to depth)','Surveyed area, required if depth is blank');
  var measuredRadius=hydraulicField('HYDRAULIC RADIUS (m; alternative to depth)','Area / wetted perimeter; required if depth is blank');
  var z = hydraulicField('BANK SIDE SLOPE (horizontal : vertical)',
    '0 = rectangle; 1 = 1H:1V','0');
  var s = hydraulicField('ENERGY SLOPE (m/m)','e.g. 0.001 = 1 m fall / 1000 m');
  var n = hydraulicField("MANNING ROUGHNESS n (SI)",'Enter a justified site value');
  modulePanel.add(button('Estimate river discharge',function() {
    hydraulicRequest++; hydraulicResults = null;
    var bottom, depth, side, gradient, roughness, flow;
    results.clear(); results.add(heading('Model estimate • Manning discharge'));
    try {
      bottom = String(y.getValue()).trim() ? readNumber(b,'Bottom width',0,false) : null;
      depth = String(y.getValue()).trim() ? readNumber(y,'Water depth',0,false) : null;
      side = readNumber(z,'Side slope',0,true);
      gradient = readNumber(s,'Energy slope',0,false);
      roughness = readNumber(n,'Manning n',0,false);
      if(depth!==null) flow = estimateManningFlow(bottom,depth,side,gradient,roughness);
      else {
        var areaInput=readNumber(measuredArea,'Cross-section area',0,false);
        var radiusInput=readNumber(measuredRadius,'Hydraulic radius',0,false);
        var velocity=Math.pow(radiusInput,2/3)*Math.sqrt(gradient)/roughness;
        flow={area:areaInput,radius:radiusInput,perimeter:areaInput/radiusInput,velocity:velocity,discharge:areaInput*velocity,topWidth:null};
      }
    } catch(err) {results.add(note(err.message)); return;}
    results.add(label('Estimated discharge: '+flow.discharge.toFixed(3)+' m³/s',18,C.teal));
    results.add(note('Mean velocity: '+flow.velocity.toFixed(3)+' m/s\n'+
      'Cross-sectional area: '+flow.area.toFixed(2)+' m²\n'+
      'Wetted perimeter: '+flow.perimeter.toFixed(2)+' m\n'+
      'Hydraulic radius: '+flow.radius.toFixed(3)+' m\n'+
      'Top water width: '+(flow.topWidth===null?'not supplied':flow.topWidth.toFixed(2)+' m')+'\n'+
      'Daily equivalent if sustained: '+(flow.discharge*86400).toFixed(0)+' m³/day'));
    results.add(note('Q = (1/n) × A × R^(2/3) × √S. '+
      'Depth is the vertical depth of an idealized rectangular/trapezoidal section. '+
      'Do not enter satellite top width as bottom width for a trapezoid. '+
      'Backwater, dam controls, floodplain flow and rapidly varied flow need more detailed modelling.'));
    if(depth!==null) { var curve = ee.FeatureCollection([0.25,0.5,0.75,1,1.25,1.5,2].map(function(f) {
      var atDepth = depth*f;
      return ee.Feature(null,{depth_m:atDepth,
        discharge_m3_s:estimateManningFlow(bottom,atDepth,side,gradient,roughness).discharge});
    }));
    results.add(ui.Chart.feature.byFeature(curve,'depth_m',['discharge_m3_s'])
      .setOptions({title:'Theoretical depth–discharge scenarios',colors:[C.teal],
        legend:{position:'none'},hAxis:{title:'Depth (m)'},vAxis:{title:'Discharge (m³/s)'},height:210}));
    results.add(note('Scenario curve holds channel shape, roughness and slope fixed. '+
      'It is not a calibrated gauge rating curve. Validate against flow measurements.'));
    }
    hydraulicResults = ee.FeatureCollection([ee.Feature(null,{method:'Manning_SI',evidence:'Model estimate; not gauge-observed discharge',
      bottom_width_m:bottom,depth_m:depth,side_slope_HV:side,slope_m_m:gradient,
      manning_n:roughness,area_m2:flow.area,wetted_perimeter_m:flow.perimeter,
      hydraulic_radius_m:flow.radius,velocity_m_s:flow.velocity,discharge_m3_s:flow.discharge,
      daily_equivalent_m3:flow.discharge*86400})]);
  }));

  results.add(note('Enter channel geometry, slope and roughness to calculate. '+
    'No example values are treated as observations.'));
}


// ================================================================
// MODULE CHARTS AND GROUNDWATER STORAGE RECORDS
// ================================================================
function chartFC(fc, x, columns, title, unit, type) {
  return ui.Chart.feature.byFeature(fc,x,columns).setChartType(type || 'LineChart')
    .setOptions({title:title,colors:[C.teal,C.gold,C.navy],backgroundColor:C.white,
      legend:{position:columns.length>1 ? 'bottom' : 'none'},
      hAxis:{title:'Month',slantedText:true,slantedTextAngle:45},
      vAxis:{title:unit},chartArea:{left:55,right:15,top:40,bottom:75},height:245});
}
function makeOpticalMonthly() {
  return ee.FeatureCollection(ee.List.sequence(1,hydroMonthCount()).map(function(m) {
    var d=ee.Date.fromYMD(year,m,1);
    var obs=s2.filterBounds(aoi).filterDate(d,hydroCutoff(d.advance(1,'month')))
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',80)).map(maskS2).map(indices);
    var comp=safeMean(obs,['MNDWI','NDVI','B3','B4']);
    var wet=comp.select('MNDWI').gt(0.15).and(comp.select('NDVI').lt(0.2));
    var analysisScale=reservoirAreaSelected ? 20 : 100;
    var area=ee.Image.pixelArea();
    var stats=area.updateMask(wet).rename('water_m2')
      .addBands(area.updateMask(comp.select('MNDWI').mask()).rename('valid_m2'))
      .reduceRegion({reducer:ee.Reducer.sum(),geometry:aoi,scale:analysisScale,
        crs:'EPSG:4326',maxPixels:1e8,tileScale:4});
    var valid=ee.Number(ee.Algorithms.If(stats.get('valid_m2'),stats.get('valid_m2'),0));
    var coverage=valid.divide(aoi.area(1));
    var reliable=coverage.gte(0.9).and(obs.size().gt(0));
    var waterArea=ee.Algorithms.If(reliable,
      ee.Number(ee.Algorithms.If(stats.get('water_m2'),stats.get('water_m2'),0)).divide(1e6),null);
    var ndti=comp.expression('(r-g)/(r+g)',{r:comp.select('B4'),g:comp.select('B3')})
      .updateMask(wet).rename('ndti');
    var turb=ndti.reduceRegion({reducer:ee.Reducer.mean(),geometry:aoi,scale:analysisScale,
      crs:'EPSG:4326',maxPixels:1e8,tileScale:4});
    return ee.Feature(null,{date:d.format('YYYY-MM'),water_km2:waterArea,
      ndti:ee.Algorithms.If(reliable,turb.get('ndti'),null),
      coverage_fraction:coverage,scene_count:obs.size()});
  }));
}
function renderModuleCharts() {
  if (activeTab==='Rainfall' || activeProduct?.key==='rain') {
    results.add(chartFC(monthlyFC,'date',['rainfall_mm'],'Monthly rainfall','mm','ColumnChart'));
  } else if (activeTab==='Evapotranspiration' || activeProduct?.key==='et') {
    results.add(chartFC(monthlyFC,'date',['ET_mm'],'Monthly evapotranspiration','mm','ColumnChart'));
    results.add(chartFC(monthlyFC,'date',['balance_mm'],'Monthly climatic balance P − ET','mm'));
  } else if (activeTab==='Surface water' || activeTab==='Turbidity') {
    if (!reservoirAreaSelected) {
      results.add(note('Draw a local polygon and analyse it to enable monthly optical charts. '+
        'National annual map is available; local charts reduce processing load.'));
      return;
    }
    if (!opticalMonthlyFC) opticalMonthlyFC=makeOpticalMonthly();
    var column=activeTab==='Turbidity' ? 'ndti' : 'water_km2';
    results.add(chartFC(opticalMonthlyFC,'date',[column],
      activeTab==='Turbidity' ? 'Monthly optical turbidity proxy' : 'Monthly mapped water area',
      activeTab==='Turbidity' ? 'NDTI (unitless)' : 'km²'));
    results.add(note('Monthly optical charts omit periods with <90% valid area coverage. '+
      'Water thresholds and cloud screening need local validation.'));
  } else if (activeTab==='Demand & stress' || activeTab==='Water balance' || activeTab==='Water Balance' || activeTab==='Drought') {
    results.add(chartFC(monthlyFC,'date',['balance_mm'],'Monthly climatic balance P − ET','mm'));
  }
}
function addBalanceMode(current) {
  modulePanel.add(note('HYDRAULIC ESTIMATES / MEASURED RECORDS'));
  modulePanel.add(ui.Select({items:['Maps & charts','Dam volume','River discharge','Groundwater records'],
    value:current,style:{stretch:'horizontal'},onChange:function(value) {
      hydraulicRequest++;hydraulicResults=null;
      if(value==='Dam volume') renderDamVolume();
      else if(value==='River discharge') renderRiverFlow();
      else if(value==='Groundwater records') renderGroundwaterStorage();
      else renderTab();
    }}));
}
function renderGroundwaterStorage() {
  resetHydraulicView('Water balance • Groundwater records');
  addBalanceMode('Groundwater records');
  modulePanel.add(note('Measured depth below ground is shown at monitoring sites. '+
    'It is not aquifer volume. Storage change needs monitoring levels, aquifer area and storage coefficients.'));
  if(!CONFIG.boreholes) {
    results.add(note('No measured groundwater records provided. Set CONFIG.boreholes to an imported '+
      'FeatureCollection with name, water_level_m and yield_lps fields. Missing values stay missing.'));
    return;
  }
  var sites=CONFIG.boreholes.filterBounds(aoi);
  map.addLayer(sites.style({color:'FFCB66',pointSize:6}),{},'Groundwater monitoring sites');
  var token=generation;
  sites.size().evaluate(function(n,error) {
    if(token!==generation) return;
    results.add(label(error ? 'Records unavailable.' : 'Monitoring sites: '+n,16,C.teal));
  });
  results.add(note('Click near a marker to inspect measured water depth and yield.'));
  legend.add({el:window.SiegLegend.create({title:'Monitoring sites',items:[{label:'Supplied monitoring site',color:'#FFCB66'}]})});

}


// ================================================================
// BASINS — PUBLIC HYDROBASINS LEVEL 6, OR USER-SUPPLIED BASINS
// ================================================================
function renderBasins() {
  resetHydraulicView('Basins • '+countryName);
  modulePanel.add(note(basinSourceName+' · catchments intersecting a 30 m search circle. Full catchment boundaries are preserved. Change the basin view in Define your area.'));
  if (basinLoadError) {results.add(note('Basin data unavailable: '+basinLoadError));return;}
  modulePanel.add(note('SELECT A BASIN'));
  var selector=ui.Select({items:basinOptions,
    value:selectedBasin || basinOptions[0],style:{stretch:'horizontal'},onChange:function(value) {
      areaRequest++;reservoirAreaSelected=false;
      selectedBasin=value===basinOptions[0] ? null : value;
      if(selectedBasin)window.SiegAreaSection?.ready(selectedBasin+' · selected catchment');else window.SiegAreaSection?.reset();
      if(!selectedBasin) {aoi=country;regionSelect.setValue(null,false);}
      else {aoi=regionFeatures[value];regionSelect.setValue(value,false);}
      drawing.layers().reset([]);
      analysisCaption.setValue(selectedBasin ? selectedBasin+' • Complete catchment' : countryName+' • National overview');
      map.centerObject(aoi);rebuild();
    }});
  modulePanel.add(selector);
  modulePanel.add(note('Analysis uses the complete selected catchment, including cross-border areas. A unit catchment is not the full upstream drainage basin.'));

  map.addLayer(basinData.style({color:'6B94BD',fillColor:'123D7110',width:1}),{},'Intersecting sub-basin outlines');
  if(selectedBasin) {
    map.addLayer(basinData.filter(ee.Filter.eq(basinField,basinLabels[selectedBasin]))
      .style({color:'123D71',fillColor:'00000000',width:3}),{},'Selected full sub-basin');
  }
  map.addLayer(boundary.style({color:'808080',fillColor:'00000000',width:2}),{},countryName+' boundary • grey');
  map.addLayer(ee.FeatureCollection([ee.Feature(aoi)]).style({color:'256EB3',
    fillColor:'00000000',width:2}),{},'Selected catchment analysis area');
  legend.add({el:window.SiegLegend.create({title:'Catchment context',items:[{label:'Intersecting sub-basins',color:'#6B94BD'},{label:'Selected full sub-basin',color:'#123D71'},{label:'Administrative boundaries',color:'#808080'}],meaning:'Analysis uses the complete selected catchment.'})});
  results.add(note(basinsLoaded ? 'Choose a sub-basin to inspect its water supply.' : 'Loading basin selector…'));
  var selected=selectedBasin ? basinData.filter(ee.Filter.eq(basinField,basinLabels[selectedBasin])) : basinData;
  var statistics=ee.Dictionary({count:selected.size(),national_area_km2:aoi.area(10).divide(1e6),
    annual_rainfall:reduce(products.rain.image,5566).get('rainfall'),
    annual_ET:reduce(products.et.image,11132).get('ET')});
  if(selectedBasin && basinField==='COMID') {
    var meritFeature=ee.Feature(selected.first());
    statistics=statistics.set('comid',meritFeature.get('COMID')).set('subbasin_area_km2',meritFeature.get('unitarea'));
  }
  if(!CONFIG.basins && selectedBasin && basinField==='HYBAS_ID') {
    var feature=ee.Feature(selected.first());
    statistics=statistics.set('subbasin_area_km2',feature.get('SUB_AREA'))
      .set('upstream_area_km2',feature.get('UP_AREA'))
      .set('hybas_id',feature.get('HYBAS_ID')).set('pfaf_id',feature.get('PFAF_ID'));
  }
  var token=generation;
  statistics.evaluate(function(values,error) {
    if(token!==generation || !['Basins','Catchment Health','Flood-risk Screening'].includes(activeTab)) return;
    if(error || !values) {results.add(note('Basin statistics unavailable: '+error));return;}
    function fmt(value) {return value==null ? 'No data' : Number(value).toFixed(1);}
    results.add(label('Selected sub-basins: '+values.count,16,C.teal));
    results.add(note('Selected catchment area: '+fmt(values.national_area_km2)+' km²\n'+
      'Annual mean rainfall: '+fmt(values.annual_rainfall)+' mm\n'+
      'Annual mean ET: '+fmt(values.annual_ET)+' mm'));
    if(values.comid!=null)results.add(note('MERIT-Basins COMID: '+values.comid+'\nUnit catchment area: '+fmt(values.subbasin_area_km2)+' km²'));
    if(values.hybas_id!=null) results.add(note('HYBAS_ID: '+values.hybas_id+'\n'+
      'PFAF_ID: '+values.pfaf_id+'\n'+
      'Full sub-basin area: '+fmt(values.subbasin_area_km2)+' km²\n'+
      'Upstream drainage area: '+fmt(values.upstream_area_km2)+' km²'));
  });
  results.add(chartFC(monthlyFC,'date',['rainfall_mm','ET_mm'],'Basin rainfall and ET','mm','ColumnChart'));
}
// Wait for country, locality and basin selection before analysis.

function hydroEvidence(key) {
 var staticPeriod={occurrence:'1984–2021',seasonality:'2021',built:'2021',crops:'2021',clay:'Static soil model',slope:'SRTM (2000); ETOPO1 fallback (2009)'};
 var units={rain:'mm (period total)',et:'mm (period total)',balance:'mm (period total)',runoff:'mm (period total)',moisture:'m³/m³',anomaly:'%',water:'km²',occurrence:'%',seasonality:'months',clay:'%',slope:'degrees',ndti:'unitless',recharge:'score 0–100',built:'km²',crops:'km²',restoration:'km²'};
 var sources={rain:'ERA5-Land precipitation (~11 km)',anomaly:'ERA5-Land precipitation (~11 km)',et:'ERA5-Land (~11 km)',balance:'ERA5-Land precipitation + ERA5-Land (~11 km)',runoff:'ERA5-Land (~11 km)',moisture:'ERA5-Land (~11 km)',water:'Sentinel-2 optical (20 m)',ndti:'Sentinel-2 optical (20 m)',occurrence:'JRC Global Surface Water (30 m)',seasonality:'JRC Global Surface Water (30 m)',clay:'OpenLandMap (250 m)',slope:'SRTM terrain (~30 m); ETOPO1 fallback (~1.8 km)',built:'WorldCover (10 m)',crops:'WorldCover (10 m)'};
 var screening=['recharge','restoration','ndti'].indexOf(key)>=0;
 var model=['et','balance','runoff','moisture','clay'].indexOf(key)>=0;
 return {unit:units[key]||'unitless',kind:screening?'Screening assessment':model?'Model estimate':'Satellite-derived observation / reference',
   period:staticPeriod[key]||year+'-01-01 to '+(year===new Date().getUTCFullYear()?new Date().toISOString().slice(0,10)+' (year to date; provider lag applies)':year+'-12-31'),baseline:key==='anomaly'?'1991–2020 matched calendar window':'Not applied',
   source:sources[key]||'Combined ERA5-Land precipitation, terrain, soil and land-cover screening',
   limit:screening?'Uncalibrated assessment; no confirmed groundwater yield, water safety or recharge volume. Partial-year screening scores are season-dependent.':key==='balance'?'P − ET excludes runoff and storage changes; not available abstraction.':'Ground validation not supplied. Missing / cloud-masked pixels may affect coverage; grid size is not an accuracy statement.'};
}

async function hydroPreviewRestoration(){
 if(!aoi||!window.SiegeUsage?.active?.freeRestoration)return;
 if(!await window.SiegeUsage.ensure(aoi))return;
 generation++;products=null;activeProduct=null;results.clear();modulePanel.clear();legend.clear();map.layers().reset([]);
 modulePanel.add(heading('Candidate infiltration restoration areas'));modulePanel.add(note('One free preview for this account. Pay for a service before requesting a report.'));
 var start=ee.Date.fromYMD(year,1,1),rain=safeSum(chirps.filterDate(start,hydroCutoff(start.advance(1,'year'))),'precipitation');
 var cover=lc.remap([10,20,30,40,50,60,70,80,90,95,100],[.75,.8,.85,.65,.1,.45,.1,0,.7,.7,.5]);
 var score=rain.unitScale(400,1400).clamp(0,1).multiply(.35).add(ee.Image(1).subtract(slope.divide(20).clamp(0,1)).multiply(.25)).add(ee.Image(1).subtract(clay.divide(60).clamp(0,1)).multiply(.25)).add(cover.multiply(.15)).multiply(100).updateMask(lc.neq(80));
 var image=score.gte(60).and(lc.eq(60).or(lc.eq(40))).selfMask().rename('priority');
 activeProduct={key:'restoration',title:'Candidate infiltration restoration areas',image,min:0,max:1,palette:['256EB3','256EB3'],scale:1000,description:'Heuristic screening: surface recharge score ≥60 on mapped 2021 cropland or bare land. Verify land tenure, soils, water quality and ecological suitability before intervention.'};
 map.addLayer(image.clip(aoi),{min:0,max:1,palette:['256EB3']},activeProduct.title);
 legend.add({el:window.SiegLegend.create({title:activeProduct.title,items:[{label:'Candidate restoration area',color:'#256EB3'}]})});
 results.add(heading(activeProduct.title+' • '+year));results.add(note(activeProduct.description));var value=label('Calculating candidate area…',13,C.teal);results.add(value);var ticket=generation;
 image.unmask(0).multiply(ee.Image.pixelArea()).divide(1e6).reduceRegion({reducer:ee.Reducer.sum(),geometry:aoi,scale:1000,maxPixels:1e7,bestEffort:true}).evaluate(function(data,error){if(ticket!==generation)return;if(error){value.setValue('Preview unavailable: '+error);return;}var area=data&&data.priority;value.setValue(Number.isFinite(area)?'Approx. candidate area: '+area.toFixed(2)+' km²':'No valid observations for this area.');hydroStatus.setValue('Free restoration preview complete. Select one service and pay to request its report.');});
}
