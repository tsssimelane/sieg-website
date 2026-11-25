function fieldsAnalysisYear(){return Number(globalThis.siegFieldsAnalysisYear||new Date().getUTCFullYear());}
function fieldsPeriodStart(){return new Date(Date.UTC(fieldsAnalysisYear(),0,1)).toISOString();}
function fieldsPeriodEnd(){return new Date(Math.min(Date.now(),Date.UTC(fieldsAnalysisYear()+1,0,1))).toISOString();}
function siegGlobalSlope(){var geom=getAnalysisGeometry();var col=ee.ImageCollection('COPERNICUS/DEM/GLO30_2024_1').filterBounds(geom.buffer(150)).select('DEM');return ee.Terrain.slope(col.mosaic().setDefaultProjection(ee.Image(col.first()).projection())).unmask(ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003')),false);}
// ================================================================
// SIEG Fields DASHBOARD
// ================================================================
// FIVE TABS
//
// 1. SOIL PROPERTIES
//    - Soil texture
//    - Soil salinity
//    - Soil organic carbon
//    - Bulk density
//
// 2. SUITABILITY
//    - Slope
//    - Erodability
//    - Irrigatability
//    - Land suitability
//    - 100 crops + 100 vegetables
//
// 3. CLIMATE (TEN COMPLETE YEARS)
//    - Analysed location
//    - 10-year mean monthly rainfall analysis
//    - 10-year mean monthly temperature analysis
//    - 10-year mean monthly resultant-wind analysis
//    - 10-year mean monthly solar radiation (not UV index)
//    - Latest complete ERA5-Land monthly analysis
//    - Open-Meteo forecast link
//
// 4. CROP MONITORING
//    - Soil moisture
//    - NDVI
//    - Pest & disease stress proxy
//
// 5. EARLY WARNING
//    - Storm/heavy-rain potential
//    - Drought development
//    - Heatwave potential
//    - Forecast warning cards
//
// ================================================================
// IMPORTANT
// ================================================================
// - Draw a polygon before area-specific analysis.
// - This is a decision-support system, not a replacement for
//   laboratory soil analysis or official meteorological warnings.
// - Pest/disease output is a remote-sensing stress proxy.
// - Irrigatability is a screening index, not an irrigation design.
// ================================================================


// ---------------------------------------------------------------
// 1. DATA IMPORTS
// ---------------------------------------------------------------

var adminFc = ee.FeatureCollection(
  'projects/ee-gee023/assets/Eswatini_Admin1'
);

var villagesFc = ee.FeatureCollection(
  'projects/ee-gee023/assets/Eswatini_Villages'
);

var soilsFc = ee.FeatureCollection(
  'projects/ee-gee023/assets/Eswatini_Soils'
);


// ---------------------------------------------------------------
// 2. GLOBAL SETTINGS
// ---------------------------------------------------------------

var defaultZoom = 8;

var panelWidth = '430px';

// Latest 12 complete available months; refreshed whenever the script runs.
var weatherRequestId = 0;
var cropRequestId = 0;

// Forecast horizon.
var forecastDays = 15;

var outlineStyle = {
  color: '0F766E',
  fillColor: '00000000',
  width: 2
};

// The Fields workspace sets the initial Africa view.

Map.setOptions('HYBRID');

// The website locator supplies the context; analysis maps start only after selecting an area.


// ---------------------------------------------------------------
// 3. DRAWING TOOLS
// ---------------------------------------------------------------

var drawingTools = Map.drawingTools();

drawingTools.setShown(true);
drawingTools.setDrawModes(['polygon']);

while (drawingTools.layers().length() > 0) {
  drawingTools.layers().remove(
    drawingTools.layers().get(0)
  );
}

drawingTools.layers().add(
  ui.Map.GeometryLayer({
    name: 'analysisPolygon',
    color: '00FFFF'
  })
);


function getAnalysisGeometry() {

  var layers = drawingTools.layers();

  if (layers.length() === 0 || layers.get(0).geometries().length() === 0) {
    return null;
  }

  return layers.get(0).getEeObject();
}


function requireGeometry(onReady) {
  if(window.SiegExplicitAnalysis&&!window.SiegExplicitAnalysis.allowed()){print("Choose indicators, then click Start analysis.");return null;}

  var geom = getAnalysisGeometry();

  if (geom === null) {

    print(
      'Draw an analysis polygon first, then run the analysis.'
    );

    return null;
  }

  if (!window.siegeAgri?.isConfirmedGeometry()) { window.SiegeUsage?.ensure(geom).then(function(ok){if(ok&&onReady)onReady();}).catch(function(e){print(e.message)}); return null; }
  return geom;
}


// ---------------------------------------------------------------
// 4. COMMON UI
// ---------------------------------------------------------------

var sidebar = ui.Panel({
  style: {
    width: panelWidth,
    padding: '12px',
    backgroundColor: 'F1F5F9'
  }
});

ui.root.insert(0, sidebar);


// ---------------------------------------------------------------
// TITLE
// ---------------------------------------------------------------

var titleLabel = ui.Label({
  value: 'SIEG Fields',
  style: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '0F766E',
    margin: '0 0 2px 0'
  }
});

var subtitleLabel = ui.Label({
  value:
    'Soils • Suitability • Weather • Crop Monitoring • Early Warning',
  style: {
    fontSize: '11px',
    color: '607D8B',
    margin: '0 0 10px 0'
  }
});

sidebar.add(titleLabel);
sidebar.add(subtitleLabel);


// ---------------------------------------------------------------
// LOCATION CONTROLS
// ---------------------------------------------------------------

var locationRow = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    margin: '4px 0 8px 0'
  }
});


var homeButton = ui.Button({
  label: 'Eswatini',
  requiresAnalysis: false,
  onClick: function() {

    Map.centerObject(
      adminFc,
      defaultZoom
    );

  },
  style: {
    stretch: 'horizontal'
  }
});


var clearButton = ui.Button({
  label: 'Clear results',
  requiresAnalysis: false,
  onClick: function() {

    resetAnalysisLayers();

  },
  style: {
    stretch: 'horizontal'
  }
});


locationRow.add(homeButton);
locationRow.add(clearButton);

sidebar.add(locationRow);


// ---------------------------------------------------------------
// VILLAGE SELECTOR
// ---------------------------------------------------------------

var villageNames = [];

var villageSelect = ui.Select({

  items: villageNames,

  placeholder: 'Zoom to village...',

  onChange: function(name) {

    var selectedVillage =
      villagesFc.filter(
        ee.Filter.eq('Name', name)
      );

    Map.centerObject(
      selectedVillage,
      13
    );

    Map.addLayer(
      selectedVillage.style({
        color: '00FFFF',
        fillColor: '00000000',
        width: 3
      }),
      {},
      'Selected village',
      true
    );

  },

  style: {
    stretch: 'horizontal'
  }

});

sidebar.add(villageSelect);

// Village search is provided by the website locator, without loading a second selector.



// ---------------------------------------------------------------
// TAB BAR
// ---------------------------------------------------------------

var tabBar = ui.Panel({

  layout:
    ui.Panel.Layout.flow('horizontal'),

  style: {
    margin: '6px 0 8px 0',
    backgroundColor: 'FFFFFF',
    padding: '3px'
  }

});

sidebar.add(tabBar);


// ---------------------------------------------------------------
// CONTENT PANEL
// ---------------------------------------------------------------

var contentPanel = ui.Panel({

  style: {
    padding: '4px 0 20px 0',
    backgroundColor: 'F1F5F9'
  }

});

sidebar.add(contentPanel);


// ---------------------------------------------------------------
// MAP LEGEND
// ---------------------------------------------------------------

var legendPanel = ui.Panel({

  style: {
    position: 'bottom-left',
    padding: '8px',
    backgroundColor: 'FFFFFF'
  }

});

Map.add(legendPanel);


// ---------------------------------------------------------------
// MAP INFORMATION PANEL
// ---------------------------------------------------------------

var mapInfoPanel = ui.Panel({

  style: {
    position: 'top-right',
    width: '320px',
    padding: '10px',
    backgroundColor: 'FFFFFF'
  }

});

// Keep explanatory detail available to report capture without covering the map.
if (mapInfoPanel.el) { mapInfoPanel.el.classList.add('analysis-report-only'); mapInfoPanel.el.setAttribute('aria-hidden','true'); }
Map.add(mapInfoPanel);


// ---------------------------------------------------------------
// WEATHER / CLIMATE MAP PANEL
// ---------------------------------------------------------------

var weatherMapPanel = ui.Panel({

  style: {
    position: 'bottom-right',
    width: '430px',
    maxHeight: '520px',
    padding: '8px',
    backgroundColor: 'FFFFFF'
  }

});

Map.add(weatherMapPanel);


function clearWeatherMapPanel() {
  weatherRequestId++;

  weatherMapPanel.clear();

}


// ---------------------------------------------------------------
// UI HELPERS
// ---------------------------------------------------------------

function addSectionTitle(textValue) {

  contentPanel.add(
    ui.Label({
      value: textValue,
      style: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '263238',
        margin: '8px 0 6px 0'
      }
    })
  );

}


function addDescription(textValue) {

  contentPanel.add(
    ui.Label({
      value: textValue,
      style: {
        fontSize: '11px',
        color: '546E7A',
        margin: '0 0 8px 0'
      }
    })
  );

}


function createIndicatorGrid() {
  var actions = ui.Panel();
  actions.el.classList.add('indicator-actions');
  contentPanel.add(actions);
  return function(label, callback) {
    return addActionButton(label, callback, actions);
  };
}

function addActionButton(
  labelText,
  callback,
  targetPanel
) {

  var button = ui.Button({

    label: labelText,

    onClick: callback,

    style: {
      stretch: 'horizontal',
      margin: '2px 0',
      backgroundColor: 'FFFFFF'
    }

  });

  (targetPanel || contentPanel).add(button);

  return button;
}


// ---------------------------------------------------------------
// RESET MAP
// ---------------------------------------------------------------

var resultLabels = [];
function resetAnalysisLayers() {
  window.SiegLandSuitability?.cancel();
  landSuitabilityRequest++;
  moistureRequestId++;
  pestRequestId++;
  resultLabels.forEach(function(label) { label.el?.remove(); });
  resultLabels = [];

  Map.layers().reset();

  // Country context is handled by the locator; avoid unrelated private-asset requests.

  legendPanel.clear();
  mapInfoPanel.clear();
  clearWeatherMapPanel();

}


// ---------------------------------------------------------------
// LEGEND
// ---------------------------------------------------------------

function addLegend(
  titleText,
  palette,
  labels,
  minValue,
  maxValue
) {

  legendPanel.clear();
  if (legendPanel.el) legendPanel.el.siegReportLegend = {title:titleText, palette, min:minValue, max:maxValue, items:Number.isFinite(minValue)&&Number.isFinite(maxValue)&&maxValue>minValue?[]:palette.map((color,i)=>({color,label:labels[i]}))};

  window.SiegHoverInspector?.setLegend(window.SiegReportMap,legendPanel.el?.siegReportLegend||{});
  if (Number.isFinite(minValue) && Number.isFinite(maxValue) && maxValue > minValue) {
    legendPanel.style().set('width','320px');
    legendPanel.add({el: window.SiegLegend.create({title:titleText, palette:palette, min:minValue, max:maxValue})});
    return;
  }

  legendPanel.add(
    ui.Label({
      value: titleText,
      style: {
        fontWeight: 'bold',
        margin: '0 0 6px 0'
      }
    })
  );


  for (
    var i = 0;
    i < palette.length;
    i++
  ) {

    var symbol = ui.Label({

      value: '',

      style: {
        backgroundColor: palette[i],
        width: '18px',
        height: '18px',
        padding: '0',
        margin: '0 6px 0 0'
      }

    });


    var label = ui.Label({

      value: labels[i],

      style: {
        fontSize: '11px',
        margin: '2px 0 0 0'
      }

    });


    legendPanel.add(
      ui.Panel({

        widgets: [
          symbol,
          label
        ],

        layout:
          ui.Panel.Layout.flow('horizontal'),

        style: {
          margin: '2px 0',
          padding: '0'
        }

      })
    );

  }


  if (
    minValue !== undefined &&
    maxValue !== undefined
  ) {

    legendPanel.add(
      ui.Label({

        value:
          'Range: ' +
          minValue +
          ' to ' +
          maxValue,

        style: {
          fontSize: '10px',
          color: '607D8B',
          margin: '5px 0 0 0'
        }

      })
    );

  }

}


// ---------------------------------------------------------------
// INFORMATION PANEL
// ---------------------------------------------------------------

function addInfo(
  titleText,
  lines
) {

  mapInfoPanel.clear();

  mapInfoPanel.add(
    ui.Label({

      value: titleText,

      style: {
        fontWeight: 'bold',
        fontSize: '15px',
        color: '0F766E'
      }

    })
  );


  lines.forEach(
    function(line) {

      mapInfoPanel.add(
        ui.Label({

          value: line,

          style: {
            fontSize: '11px',
            margin: '3px 0'
          }

        })
      );

    }
  );

}


// ---------------------------------------------------------------
// RESULT VALUE
// ---------------------------------------------------------------

function addResultValue(
  labelText,
  eeValue,
  digits
) {

  var label = ui.Label(

    labelText +
    ': calculating...',

    {
      fontSize: '11px',
      margin: '3px 0'
    }

  );

  contentPanel.add(label);
  resultLabels.push(label);

  eeValue.evaluate(
    function(value, error) {

      if (error) { label.setValue(labelText + ': unavailable — ' + String(error)); return; }
      var output = value == null ? 'No data for this area' : value;

      if (
        typeof value === 'number' &&
        digits !== undefined
      ) {

        output =
          value.toFixed(digits);

      }

      label.setValue(
        labelText +
        ': ' +
        output
      );

    }
  );


  return label;
}


// ================================================================
// 5. REMOTE SENSING FUNCTIONS
// ================================================================


// ---------------------------------------------------------------
// SENTINEL-2
// ---------------------------------------------------------------

function getSentinel2(geom, startDate, endDate) {
  var bands = ['B2', 'B3', 'B4', 'B5', 'B8', 'B8A', 'B11'];
  var source = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geom).filterDate(startDate || fieldsPeriodStart(), endDate || fieldsPeriodEnd())
    .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 40));
  var clear = source.map(function(image) {
    var scl = image.select('SCL');
    var mask = scl.neq(0).and(scl.neq(1)).and(scl.neq(3))
      .and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
    return image.select(bands).toFloat().updateMask(mask);
  });
  // A fully masked seed preserves the band schema, never a fabricated observation.
  var seed = ee.Image.constant([0, 0, 0, 0, 0, 0, 0]).rename(bands)
    .toFloat().updateMask(ee.Image(0));
  return clear.merge(ee.ImageCollection.fromImages([seed])).median().clip(geom)
    .set('sieg_scene_count', source.size());
}


function getNdvi(geom) {

  var s2 =
    getSentinel2(geom);

  return s2
    .normalizedDifference(
      ['B8', 'B4']
    )
    .rename('NDVI')
    .clip(geom);

}


function getNdmi(geom) {

  var s2 =
    getSentinel2(geom);

  return s2
    .normalizedDifference(
      ['B8', 'B11']
    )
    .rename('NDMI')
    .clip(geom);

}


// ---------------------------------------------------------------
// ERA5-LAND MONTHLY
// ---------------------------------------------------------------

// ================================================================
// 6. SOIL PROPERTIES
// ================================================================

function buildSoilTab() {

  contentPanel.clear();

  addSectionTitle(
    'SOIL PROPERTIES'
  );

  addDescription(
    'Select soil texture or texture-based irrigation management screening.'
  );

  var addIndicator = createIndicatorGrid();


  // -------------------------------------------------------------
  // SOIL TEXTURE
  // -------------------------------------------------------------

  addIndicator(
    'Soil texture',
    function() {

      var geom =
        requireGeometry();

      if (geom === null)
        return;

      resetAnalysisLayers();


      var texture =
        ee.Image(
          'OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02'
        )
        .select('b0')
        .clip(geom);


      Map.addLayer(
        texture,
        {
          min: 1,
          max: 12,
          palette: [
            'F5F5DC',
            'E6D3A3',
            'D2B48C',
            'B8860B',
            'A0522D',
            '8B4513',
            '704214',
            '5D4037',
            '795548',
            '6D4C41',
            '4E342E',
            '3E2723'
          ]
        },
        'Soil texture',
        true
      );


      addLegend(
        'USDA soil texture class',
        [
          'F5F5DC',
          'E6D3A3',
          'D2B48C',
          'B8860B',
          'A0522D',
          '8B4513',
          '704214',
          '5D4037',
          '795548',
          '6D4C41',
          '4E342E',
          '3E2723'
        ],
        [
          'Clay',
          'Silty clay',
          'Sandy clay',
          'Clay loam',
          'Silty clay loam',
          'Sandy clay loam',
          'Loam',
          'Silt loam',
          'Sandy loam',
          'Silt',
          'Loamy sand',
          'Sand'
        ]
      );


      addInfo(
        'Soil texture',
        [
          'Source: OpenLandMap USDA texture class.',
          'The layer provides a spatial texture classification.',
          'Use field sampling for detailed agricultural decisions.'
        ]
      );

    }
  );

  addIndicator('Soil irrigatability', function() {
    var geom = requireGeometry();
    if (geom === null) return;
    resetAnalysisLayers();
    var model = window.SiegSoilIrrigability;
    Map.addLayer(model.image(ee, geom), {min:1,max:3,palette:model.palette}, 'Soil irrigatability', true);
    addLegend('Soil irrigatability · texture screening', model.palette, model.labels);
    addInfo('Soil irrigatability', [model.source]);
  });
}

function buildSuitabilityTab() {
  contentPanel.clear();addSectionTitle('LAND SUITABILITY');
  addDescription('Assess agricultural land suitability using mapped soil, terrain and land cover.');
  var addIndicator=createIndicatorGrid();
  addIndicator('Land suitability',function(){var geom=requireGeometry(function(){showTab('suitability');});if(geom===null)return;resetAnalysisLayers();runGlobalLandSuitability(geom);});
  addIndicator('Slope',function(){var geom=requireGeometry();if(geom===null)return;resetAnalysisLayers();var slope=siegGlobalSlope().clip(geom);Map.addLayer(slope,{min:0,max:45,palette:['218B8C','94B447','E6B647','B97745','B95440']},'Slope (degrees)',true);addLegend('Terrain slope (degrees)',['218B8C','94B447','E6B647','B97745','B95440'],['0°','11.25°','22.5°','33.75°','45° and above']);addInfo('Slope',['Copernicus GLO30 2024_1 (~30 m surface model), with SRTM fallback where Copernicus pixels are missing.','Slope is measured in degrees, not percent. Values above 45° share the top colour. Missing terrain pixels remain unclassified.','Use field measurements for detailed design and earthworks.']);});
}
function buildRecommendationTab() {
  contentPanel.clear();addSectionTitle('SUITABLE CROPS, VEGETABLES & FRUIT TREES');
  addDescription('Choose crops, vegetables or fruit trees to screen against your field climate and soil texture.');
  contentPanel.add(ui.Select({items:['Crops','Vegetables','Fruit trees'],placeholder:'Choose a recommendation group…',onChange:function(value){showCropSelection(value==='Fruit trees'?'Fruit tree':value==='Crops'?'Crop':'Vegetable');},style:{stretch:'horizontal',margin:'6px 0'}}));
}

var landSuitabilityRequest = 0;
function runGlobalLandSuitability(geom, reason) {
  var token = ++landSuitabilityRequest;
  var progressLabel = ui.Label(reason || 'Loading global soil and terrain screening…', {fontSize:'12px',color:'0F766E'});
  mapInfoPanel.add(progressLabel);
  if (!window.SiegLandSuitability) {progressLabel.setValue('Global screening did not load. Refresh the page and retry.');return;}
  var current = function(){return token === landSuitabilityRequest && window.siegeAgri.getGeometry() === geom;};
  window.SiegLandSuitability.analyse(ee,geom,{current:current,onProgress:function(message){if(current())progressLabel.setValue(message);}}).then(function(product){
    if(!product || !current())return;
    window.SiegFieldsLastSuitability=product;
    Map.addLayer(product.image,{min:1,max:5,palette:window.SiegLandSuitability.palette},'Land suitability — global screening',true);
    addLegend('Agricultural land screening',window.SiegLandSuitability.palette,window.SiegLandSuitability.labels);
    var st=product.stats, means=st.means||{};
    var lines=[(product.provider==='soilgrids'?'SoilGrids 2.0 · weighted 0–30 cm':'OpenLandMap v02 · 10 cm')+' · 250 m soil grid',
      'Data coverage: '+st.coverage.toFixed(1)+'% of your AOI. '+(st.coverage<90?'Partial coverage; gaps are unclassified.':'Missing pixels remain unclassified.'),
      'Terrain: '+(product.terrainProvider==='copernicus'?'Copernicus GLO30 2024_1 (~30 m surface model)':'SRTM (~30 m, limited geographic coverage)'),
      'Generic soil and terrain screening, not a crop-specific or official land classification. Full method and sources are included in the requested report.'];
    product.stats.groups.forEach(function(row){lines.push(window.SiegLandSuitability.labels[row.class-1]+': '+Number(row.sum).toFixed(2)+' ha');});
    [['ph','pH',''],['clay','Clay','%'],['soc','Organic carbon','g/kg'],['slope','Slope','°']].forEach(function(v){if(means[v[0]]!=null)lines.push(v[1]+': '+Number(means[v[0]]).toFixed(1)+' '+v[2]);});
    if(product.warnings.length)lines.push('An alternative source was used or coverage varied; see report source notes.');
    addInfo('Global land suitability',lines);
  }).catch(function(error){if(current())progressLabel.setValue('Suitability unavailable: '+error.message+' Draw another area or retry.');});
}

// ================================================================
// 8. CROP DATABASE
// ================================================================

// Published profiles are maintained in crop-catalog.js.

// ================================================================
// 9. CROP SELECTION
// ================================================================

// Sources and class codes verified against the official Earth Engine catalog:
// https://developers.google.com/earth-engine/datasets/catalog/OpenLandMap_SOL_SOL_TEXTURE-CLASS_USDA-TT_M_v02
// https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_MONTHLY_AGGR

// Climate uses ten complete available calendar years, shared by charts and crop selection.

function weatherBands(image) {
  var date = ee.Date(image.get('system:time_start'));
  var days = date.advance(1, 'month').difference(date, 'day');
  return image.select('total_precipitation_sum').max(0).multiply(1000).rename('rain_mm')
    .addBands(image.select('temperature_2m').subtract(273.15).rename('temp_c'))
    .addBands(image.select('u_component_of_wind_10m').pow(2)
      .add(image.select('v_component_of_wind_10m').pow(2)).sqrt().rename('wind_ms'))
    .addBands(image.select('surface_solar_radiation_downwards_sum').max(0)
      .divide(1e6).divide(days).rename('solar_mj'))
    .copyProperties(image, ['system:time_start']).set('days', days);
}

function getWeatherWindow(geom, yearsBack) {
  yearsBack = yearsBack || 0;
  var now = ee.Date(Date.now());
  var currentMonth = ee.Date.fromYMD(now.get('year'), now.get('month'), 1);
  var collection = ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY_AGGR')
    .filterDate('1990-01-01', currentMonth);
  var latest = ee.Image(collection.sort('system:time_start', false).first());
  var latestDate = ee.Date(latest.get('system:time_start'));
  // Keep a complete 120-month baseline, ending at the latest published month.
  var end = latestDate.advance(1,'month').advance(-yearsBack,'year');
  var start = end.advance(-10, 'year');
  var raw = collection.filterDate(start, end);
  var history = raw.map(weatherBands);
  var names = ['rain_mm', 'temp_c', 'wind_ms', 'solar_mj'];
  var empty = ee.Image.constant([0, 0, 0, 0]).rename(names).updateMask(ee.Image(0));
  function reduce(image) {
    var regional = image.reduceRegion({reducer: ee.Reducer.mean(), geometry: geom,
      scale: 11132, bestEffort: true, maxPixels: 1e8, tileScale: 2});
    var point = image.reduceRegion({reducer: ee.Reducer.first(),
      geometry: geom.centroid(100), scale: 11132, maxPixels: 1e6});
    return ee.Dictionary.fromLists(names, ee.List(names).map(function(key) {
      key = ee.String(key);
      var value = regional.get(key);
      return ee.Algorithms.If(ee.Algorithms.IsEqual(value, null), point.get(key), value);
    }));
  }
  var rows = ee.FeatureCollection(ee.List.sequence(1, 12).map(function(month) {
    month = ee.Number(month);
    var sameMonth = history.filter(ee.Filter.calendarRange(month, month, 'month'));
    var average = sameMonth.merge(ee.ImageCollection.fromImages([empty])).mean();
    // Reference date is used only to order January–December, not to label observations.
    var reference = ee.Date.fromYMD(2001, month, 1);
    return ee.Feature(null, reduce(average)).set({
      month: reference.format('MMM'), month_number: month,
      days: sameMonth.aggregate_mean('days'), historical_samples: sameMonth.size(),
      'system:time_start': reference.millis()
    });
  })).sort('month_number');
  return {rows: rows, metadata: ee.Dictionary({
    start: start.format('YYYY'), end: end.advance(-1, 'day').format('YYYY'),
    count: 12, months: 12, sourceMonths: raw.size(),
    distinctSourceMonths: raw.aggregate_array('system:time_start').distinct().size(),
    averageStart: start.format('MMM YYYY'), averageEnd: end.advance(-1, 'month').format('MMM YYYY'),
    yearsBack: yearsBack, mode: 'Rolling 10-year calendar-month baseline'
  })};
}

var climateCache = Object.create(null);
var climatePending = Object.create(null);
function loadWeatherData(geom, callback) {
  var key = geom.serialize();
  var cached = climateCache[key];
  if (cached && Date.now() - cached.time < 30*60000) {
    setTimeout(function(){ callback(cached.value, null); }, 0); return;
  }
  if (!climatePending[key]) {
    climatePending[key] = new Promise(function(resolve, reject) {
      fetchWeatherData(geom, function(value, error) {
        if (error) reject(error); else resolve(value);
      });
    }).then(function(value) {
      delete climatePending[key];
      return value;
    }, function(error) {
      delete climatePending[key];
      throw error;
    });
  }
  climatePending[key].then(function(value){callback(value, null);}, function(error){callback(null, error);});
}
function fetchWeatherData(geom, callback, yearsBack) {
  yearsBack = yearsBack || 0;
  var cacheKey = geom.serialize();
  var cached = climateCache[cacheKey];
  if (!yearsBack && cached && Date.now()-cached.time < 30*60000) { setTimeout(function(){callback(cached.value,null)},0); return; }
  var data = getWeatherWindow(geom, yearsBack);
  function retry(error) {
    if (yearsBack < 2) { fetchWeatherData(geom, callback, yearsBack + 1); return; }
    callback(null, error || 'A complete ten-year climate record could not be loaded for this area.');
  }
  data.metadata.evaluate(function(metadata, metadataError) {
    if (metadataError || !metadata) { retry(metadataError); return; }
    if (metadata.sourceMonths !== 120 || metadata.distinctSourceMonths !== 120) {
      retry('The selected decade has missing source months.'); return;
    }
    data.rows.evaluate(function(fc, error) {
      var features = fc && fc.features;
      var valid = !error && features && features.length === 12 && features.every(function(f) {
        return f.properties.historical_samples === 10 &&
          ['rain_mm', 'temp_c', 'days'].every(function(key) {
            return typeof f.properties[key] === 'number' && isFinite(f.properties[key]);
          });
      });
      if (!valid) { retry(error); return; }
      var value = {metadata:metadata,rows:fc};
      if(Object.keys(climateCache).length>=4)delete climateCache[Object.keys(climateCache)[0]];
      climateCache[cacheKey]={time:Date.now(),value:value};
      callback(value,null);
    });
  });
}

function showCropSelection(type) { return window.SiegCropScreen.show(type); }

function buildWeatherTab() {
  contentPanel.clear();
  addSectionTitle('CURRENT CLIMATE');
  addDescription('Current-year observations run through today, subject to source publication lag. Crop screening retains a separate rolling ten-year baseline ending at the latest complete source month.');
  var geom = requireGeometry(buildWeatherTab);
  if (geom === null) { contentPanel.clear(); addSectionTitle('CLIMATE'); addDescription('Close your analysis polygon, then select Climate to load results.'); return; }
  addDescription(getAnalysisGeometry() ? 'Area: your analysis polygon' : 'Area: all Eswatini. Draw a polygon for local analysis.');
  addActionButton('Refresh climate analysis', buildWeatherTab);
  var link = ui.Label('Open location weather and UV forecast →', {color: '0F766E', fontWeight: 'bold'});
  contentPanel.add(link);
  geom.centroid(100).coordinates().evaluate(function(coords, error) {
    if (!error && coords) link.setUrl('https://open-meteo.com/en/docs?latitude=' + coords[1] + '&longitude=' + coords[0]);
  });
  addDescription('Ten-year mean monthly rainfall totals, temperature, resultant wind and solar radiation. Solar radiation is not UV index. Live forecasts are available through the link. For polygons smaller than a weather grid cell, the centroid cell is used when an area average is unavailable.');
  buildClimateMapPanel(geom);
  buildCurrentClimatePanel(geom);
}

function buildClimateMapPanel(geom) {
  var request = ++weatherRequestId;
  weatherMapPanel.clear();
  var heading = ui.Label('HISTORICAL CLIMATE BASELINE', {fontWeight: 'bold', fontSize: '16px', color: '0F766E'});
  var status = ui.Label('Loading ten-year climate averages...', {fontSize: '11px', color: '475569', whiteSpace: 'pre-wrap'});
  weatherMapPanel.add(heading); weatherMapPanel.add(status);
  var charts = ui.Panel(); weatherMapPanel.add(charts);
  var summary = ui.Panel({style: {padding: '8px', backgroundColor: 'F0FDFA'}});
  weatherMapPanel.add(summary);
  loadWeatherData(geom, function(value, error) {
    if (request !== weatherRequestId) return;
    if (error || !value || value.metadata.count !== 12 || value.metadata.months !== 12) {
      status.setValue('Climate unavailable: ' + (error || 'Could not load ten complete years. Please refresh.')); return;
    }
    var rows = value.rows.features.map(function(f) { return f.properties; });
    status.setValue((value.metadata.averageStart||value.metadata.start) + ' – ' + (value.metadata.averageEnd||value.metadata.end) + ' | ' + value.metadata.mode + '\n120 source months · 10 observations per calendar month' + (value.metadata.yearsBack ? '\nEarlier complete decade used due to missing data' : ''));
    var specs = [
      ['rain_mm', 'Mean monthly rainfall (10 years)', 'mm/month', '2563EB', 'ColumnChart'],
      ['temp_c', 'Mean monthly temperature (10 years)', '°C', 'EA580C', 'LineChart'],
      ['wind_ms', 'Mean monthly resultant wind at 10 m', 'm/s', '0F766E', 'LineChart'],
      ['solar_mj', 'Mean solar radiation (not UV index)', 'MJ/m²/day', 'CA8A04', 'LineChart']
    ];
    specs.forEach(function(spec) {
      var valid = rows.filter(function(r) { return typeof r[spec[0]] === 'number'; });
      if (!valid.length) { charts.add(ui.Label(spec[1] + ': no valid pixels.')); return; }
      // Reuse the evaluated table: chart rendering must not request Earth Engine again.
      var chartRows = value.rows;
      charts.add(ui.Chart.feature.byFeature(chartRows, 'month', [spec[0]]).setChartType(spec[4]).setOptions({
        title: spec[1], colors: ['#' + spec[3]], legend: {position: 'none'},
        hAxis: {title: 'Month', slantedText: true, slantedTextAngle: 45, textStyle: {fontSize: 9}},
        vAxis: {title: spec[2]}, height: 220, pointSize: 4, lineWidth: 2,
        chartArea: {left: 65, right: 15, top: 40, bottom: 70}, interpolateNulls: false
      }));
      var totalDays = valid.reduce(function(a,r) { return a + r.days; }, 0);
      var result = spec[0] === 'rain_mm'
        ? valid.reduce(function(a,r) { return a + r[spec[0]]; }, 0)
        : valid.reduce(function(a,r) { return a + r[spec[0]] * r.days; }, 0) / totalDays;
      var min = Math.min.apply(null, valid.map(function(r) { return r[spec[0]]; }));
      var max = Math.max.apply(null, valid.map(function(r) { return r[spec[0]]; }));
      summary.add(ui.Label((spec[0] === 'rain_mm' ? 'Mean annual rainfall (10-year climate)' : spec[1]) + ': ' + result.toFixed(1) +
        ' ' + (spec[0] === 'rain_mm' ? 'mm' : spec[2]), {fontWeight: 'bold', fontSize: '11px'}));
      summary.add(ui.Label('Monthly range: ' + min.toFixed(1) + '–' + max.toFixed(1) +
        ' | Valid months: ' + valid.length + '/12', {fontSize: '10px', color: '475569'}));
    });
    charts.add(ui.Label('Wind is the magnitude of monthly mean wind components; it can underestimate average scalar wind speed. Solar radiation cannot be converted directly to UV index.',
      {fontSize: '10px', color: '64748B'}));
  });
}


// ================================================================
// 12. CROP MONITORING
// ================================================================

var moistureRequestId = 0;
var pestRequestId = 0;

function buildCropMonitoringTab() {

  contentPanel.clear();

  addSectionTitle(
    'CROP MONITORING'
  );

  addDescription(
    'Satellite-based indicators for vegetation health, root-zone moisture and crop stress.'
  );

  var addIndicator = createIndicatorGrid();


  // -------------------------------------------------------------
  // NDVI
  // -------------------------------------------------------------

  addIndicator(
    'NDVI',
    function() {

      var geom =
        requireGeometry();

      if (geom === null)
        return;

      resetAnalysisLayers();


      var ndvi =
        getNdvi(
          geom
        );


      Map.addLayer(
        ndvi,
        {
          min: 0,
          max: 1,
          palette: [
            '8B0000',
            'FF8A65',
            'FFF176',
            '9CCC65',
            '0F766E'
          ]
        },
        'NDVI',
        true
      );


      addLegend(
        'NDVI',
        [
          '8B0000',
          'FF8A65',
          'FFF176',
          '9CCC65',
          '0F766E'
        ],
        [
          'Very low',
          'Low',
          'Moderate',
          'Good',
          'Very high'
        ],
        0,
        1
      );


      var meanNdvi =
        ndvi.reduceRegion({

          reducer:
            ee.Reducer.mean(),

          geometry:
            geom,

          scale:
            20,

          bestEffort:
            true

        })
        .get(
          'NDVI'
        );


      addResultValue(
        'Mean NDVI',
        meanNdvi,
        2
      );

    }
  );


  // -------------------------------------------------------------
  // ROOT-ZONE MOISTURE: latest available seven-day mean, not a stress index.
  // -------------------------------------------------------------
  addIndicator('Root-Zone Moisture', function() {
    var geom = requireGeometry();
    if (!geom) return;
    resetAnalysisLayers();
    var request = ++moistureRequestId;
    var status = ui.Label('Loading root-zone moisture...', {fontSize: '12px', color: '0F766E'});
    contentPanel.add(status);
    var collection = ee.ImageCollection('NASA/SMAP/SPL4SMGP/008')
      .filterDate(fieldsPeriodStart(),fieldsPeriodEnd()).select('sm_rootzone');
    collection.aggregate_max('system:time_start').evaluate(function(latest, error) {
      if (request !== moistureRequestId) return;
      if (error || typeof latest !== 'number' || !isFinite(latest)) {
        status.setValue('Root-zone moisture data is currently unavailable.'); return;
      }
      var end = ee.Date(latest).advance(3, 'hour');
      var start = end.advance(-7, 'day');
      var moisture = collection.filterDate(start, end).mean().rename('rootzone_moisture').clip(geom);
      var palette = ['8C510A', 'D8B365', 'F6E8C3', 'C7EAE5', '5AB4AC', '01665E'];
      Map.addLayer(moisture, {min: 0, max: 0.5, palette: palette}, 'Root-Zone Moisture (0–100 cm, 7-day mean)', true);
      addLegend('Root-zone moisture (m³/m³)', palette,
        ['0.00', '0.10', '0.20', '0.30', '0.40', '0.50'], 0, 0.5);
      addInfo('Root-Zone Moisture', ['Source: NASA SMAP L4 SPL4SMGP/008, sm_rootzone.',
        'Latest available seven-day mean; modelled volumetric water content.',
        'Root-zone layer: 0–100 cm. Earth Engine pixel size: approximately 11 km (9 km source product).',
        'Latest sample: ' + new Date(latest).toISOString().slice(0, 10) + '.',
        'Display range: 0–0.5 m³/m³. Regional model estimate; not a field measurement or water-stress score.']);
      var regional = moisture.reduceRegion({reducer: ee.Reducer.mean(), geometry: geom,
        scale: 11000, bestEffort: true, maxPixels: 1e8});
      var point = moisture.reduceRegion({reducer: ee.Reducer.first(), geometry: geom.centroid(100), scale: 11000});
      var value = ee.Algorithms.If(ee.Algorithms.IsEqual(regional.get('rootzone_moisture'), null),
        point.get('rootzone_moisture'), regional.get('rootzone_moisture'));
      ee.Dictionary({moisture: value}).evaluate(function(result, resultError) {
        if (request !== moistureRequestId) return;
        var number = result && result.moisture;
        status.setValue(!resultError && typeof number === 'number' && isFinite(number)
          ? 'Mean root-zone moisture (0–100 cm): ' + number.toFixed(3) + ' m³/m³ | Latest sample: ' + new Date(latest).toISOString().slice(0, 10)
          : 'No valid root-zone moisture value for this polygon.');
      });
    });
  });


  // -------------------------------------------------------------
  // PEST & DISEASE
  // -------------------------------------------------------------

  addIndicator(
    'Pest & disease stress',
    function() {

      var geom =
        requireGeometry();

      if (geom === null)
        return;

      resetAnalysisLayers();


      var s2 =
        getSentinel2(
          geom
        );


      var ndvi =
        s2
          .normalizedDifference(
            ['B8', 'B4']
          )
          .rename(
            'NDVI'
          );


      var ndmi =
        s2
          .normalizedDifference(
            ['B8', 'B11']
          )
          .rename(
            'NDMI'
          );


      var redEdge =
        s2
          .normalizedDifference(
            ['B8A', 'B5']
          )
          .rename(
            'RE'
          );


      // Invert the index itself rather than starting with a constant image.
      var ndviStress = ndvi.unitScale(0.25, 0.75).clamp(0, 1).multiply(-1).add(1);
      var ndmiStress = ndmi.unitScale(-0.2, 0.5).clamp(0, 1).multiply(-1).add(1);
      var redEdgeStress = redEdge.unitScale(0.1, 0.5).clamp(0, 1).multiply(-1).add(1);

      var pestStress =
        ndviStress
          .multiply(0.45)

          .add(
            ndmiStress
              .multiply(0.30)
          )

          .add(
            redEdgeStress
              .multiply(0.25)
          )

          .rename(
            'pest_disease_stress'
          )

          .clip(geom);


      var request = ++pestRequestId;
      var status = ui.Label('Checking clear Sentinel-2 observations...', {fontSize:'11px'});
      contentPanel.add(status);
      ee.Dictionary({
        scenes: s2.get('sieg_scene_count'),
        stats: pestStress.reduceRegion({reducer:ee.Reducer.mean(), geometry:geom,
          scale:20, maxPixels:1e8, bestEffort:true, tileScale:4})
      }).evaluate(function(result, error) {
        if (request !== pestRequestId) return;
        if (error) {
          status.setValue('Pest/disease stress proxy unavailable: ' + String(error));
          return;
        }
        var mean = result && result.stats && result.stats.pest_disease_stress;
        if (!result || !result.scenes || typeof mean !== 'number' || !isFinite(mean)) {
          status.setValue('Pest/disease stress proxy: no usable clear observations for this area and period. No stress score or map has been inferred.');
          addInfo('Pest & disease proxy availability', ['No usable Sentinel-2 observations for the selected area and period.', 'This is a no-data result, not evidence of healthy or diseased crops.']);
          return;
        }
        status.setValue('Mean vegetation stress proxy: ' + mean.toFixed(2) + ' / 1.00. Field inspection is required.');
      Map.addLayer(
        pestStress,
        {
          min: 0,
          max: 1,
          palette: [
            '0F766E',
            '8BC34A',
            'FDD835',
            'FB8C00',
            'B71C1C'
          ]
        },
        'Pest disease stress proxy',
        true
      );


      addLegend(
        'Pest & disease stress proxy',
        [
          '0F766E',
          '8BC34A',
          'FDD835',
          'FB8C00',
          'B71C1C'
        ],
        [
          'Low',
          'Mild',
          'Moderate',
          'High',
          'Severe'
        ],
        0,
        1
      );


      addInfo(
        'Pest & disease',
        [
          'Remote-sensing stress screening, not a pest or disease diagnosis.',
          'Cloud, shadow and snow masked Sentinel-2 median for the selected period.',
          'NDVI 45%, NDMI 30%, red-edge index 25%; combined on a 20 m analysis grid.',
          'It cannot identify a specific pest or pathogen.',
          'High-stress areas should be inspected in the field.'
        ]
      );

      });

    }
  );

}


// ================================================================
// 13. EARLY WARNING
// ================================================================

var warningRequestId = 0;

function formatWarningScore(score, error) {
  if (error || typeof score !== 'number' || !isFinite(score)) return 'No forecast value available';
  var status = score < 0.25 ? 'LOW' : score < 0.50 ? 'MODERATE' : score < 0.75 ? 'HIGH' : 'VERY HIGH';
  return status + ' | score: ' + score.toFixed(2);
}

function buildRootZoneDroughtAlert(warningPanel, geom, request) {
  var panel = ui.Panel({style:{padding:'10px',margin:'6px 0',backgroundColor:'F1F5F9'}});
  panel.add(ui.Label('DROUGHT-DEVELOPMENT ALERTS',{fontWeight:'bold',fontSize:'13px'}));
  var alert = ui.Label('Loading root-zone moisture and recent drying...', {fontWeight:'bold',fontSize:'12px'});
  var details = ui.Label('', {fontSize:'11px',whiteSpace:'pre-wrap'});
  panel.add(alert);panel.add(details);
  panel.add(ui.Label('Regional screening estimate · 0–100 cm root zone · ~11 km Earth Engine grid. Verify conditions in the field.',{fontSize:'10px',color:'64748B'}));
  warningPanel.add(panel);
  var data = {}, now = Date.now();
  function active(){return request===warningRequestId;}
  function render(){
    if(!active()||!data.rootReady)return;
    var assessment=SiegRootZoneAlerts.classify(data,Date.now());
    alert.setValue(assessment.level+' · '+assessment.message);
    var lines=[];
    if(typeof data.current==='number')lines.push('Root-zone moisture (7-day mean): '+data.current.toFixed(3)+' m³/m³');
    if(typeof data.percentile==='number')lines.push('Mean moisture percentile: '+data.percentile.toFixed(0)+'%');
    if(typeof data.current==='number'&&typeof data.previous==='number'){var delta=data.current-data.previous;lines.push('Change from preceding 7 days: '+(delta>=0?'+':'')+delta.toFixed(3)+' m³/m³');}
    if(typeof data.latest==='number')lines.push('Latest SMAP sample: '+new Date(data.latest).toISOString().slice(0,10));
    if(typeof data.rain==='number')lines.push('Forecast rain: '+data.rain.toFixed(1)+' mm over '+data.forecastHours+' hours');
    else lines.push('Forecast rainfall unavailable or still loading.');
    lines.push('Screening thresholds: moisture ≤20th percentile; drying ≥0.010 m³/m³ per comparison; limited rain <2 mm/day. Not crop-specific or calibrated.');
    details.setValue(lines.join('\n'));
  }
  function regional(image,band,scale){
    var mean=image.reduceRegion({reducer:ee.Reducer.mean(),geometry:geom,scale:scale,bestEffort:true,maxPixels:1e8});
    var point=image.reduceRegion({reducer:ee.Reducer.first(),geometry:geom.centroid(100),scale:scale});
    return ee.Algorithms.If(ee.Algorithms.IsEqual(mean.get(band),null),point.get(band),mean.get(band));
  }
  var smap=ee.ImageCollection('NASA/SMAP/SPL4SMGP/008').filterDate(new Date(now-45*86400000).toISOString(),new Date(now).toISOString()).select(['sm_rootzone','sm_rootzone_pctl']);
  smap.aggregate_max('system:time_start').evaluate(function(latest,error){
    if(!active())return;
    if(error||typeof latest!=='number'||!isFinite(latest)){alert.setValue('INSUFFICIENT DATA · No recent root-zone moisture is available.');return;}
    var end=ee.Date(latest).advance(3,'hour'),start=end.advance(-7,'day');
    var empty=ee.Image.constant([0,0]).toFloat().rename(['sm_rootzone','sm_rootzone_pctl']).updateMask(ee.Image(0));
    var recent=smap.filterDate(start,end).merge(ee.ImageCollection.fromImages([empty]));
    var prior=smap.filterDate(start.advance(-7,'day'),start).merge(ee.ImageCollection.fromImages([empty]));
    var current=recent.select('sm_rootzone').mean().rename('current').clip(geom);
    var previous=prior.select('sm_rootzone').mean().rename('previous').clip(geom);
    var percentile=recent.select('sm_rootzone_pctl').mean().rename('percentile').clip(geom);
    var countRecent=recent.select('sm_rootzone').count().rename('recentCount').clip(geom),countPrior=prior.select('sm_rootzone').count().rename('priorCount').clip(geom);
    ee.Dictionary({current:regional(current,'current',11000),previous:regional(previous,'previous',11000),percentile:regional(percentile,'percentile',11000),recentCount:regional(countRecent,'recentCount',11000),priorCount:regional(countPrior,'priorCount',11000)}).evaluate(function(values,readError){
      if(!active())return;
      if(readError||!values){alert.setValue('INSUFFICIENT DATA · Root-zone conditions could not be read for this area.');return;}
      Object.keys(values).forEach(function(k){data[k]=values[k]});data.latest=latest;data.rootReady=true;render();
      if(typeof values.percentile==='number'&&now-latest<=7*86400000){
        var dryness=ee.Image(1).subtract(percentile.divide(100)).clamp(0,1).rename('rootzone_dryness');
        Map.addLayer(dryness,{min:0,max:1,palette:['0F766E','8BC34A','FDD835','FB8C00','B71C1C']},'Drought development / root-zone dryness',false);
      }
      addInfo('Drought-development alerts',['NASA SMAP L4: sm_rootzone (0–100 cm) and sm_rootzone_pctl; current and preceding seven-day windows.','Percentile means relative moisture conditions, not probability of crop loss.','Rainfall context: available ECMWF IFS steps up to 72 hours.','Screening rules are uncalibrated; no current alert with stale, missing or sparse data.','SMAP source grid 9 km; Earth Engine pixel size ~11 km. Small polygons use the containing grid cell when required.']);
    });
  });
  return function(run,hours,creation){
    if(!active())return;
    if(!run){data.rain=null;render();return;}
    var available=hours.filter(function(h){return h>=0&&h<=72});
    if(!available.length){data.rain=null;render();return;}
    var horizon=Math.max.apply(null,available),rain=run.filter(ee.Filter.lte('forecast_hours',horizon)).select('total_precipitation_sfc').max().max(0).multiply(1000).rename('rain').clip(geom);
    ee.Dictionary({rain:regional(rain,'rain',28000)}).evaluate(function(value,error){if(!active())return;data.rain=!error&&value&&typeof value.rain==='number'?value.rain:null;data.forecastHours=horizon;data.creation=creation;render();});
  };
}

function buildEarlyWarningTab() {
  var request = ++warningRequestId;
  contentPanel.clear();
  addSectionTitle('EARLY WARNING');
  addDescription('Screen the latest available ECMWF IFS forecast. Only existing forecast steps are used.');
  var warningPanel = ui.Panel({style: {margin: '8px 0', padding: '8px', backgroundColor: 'FFFFFF'}});
  contentPanel.add(warningPanel);
  var status = ui.Label('Loading available forecast...', {fontSize: '12px', color: '0F766E'});
  warningPanel.add(status);
  var geom = requireGeometry(buildEarlyWarningTab);
  if (!geom) { status.setValue('Close your analysis polygon, then select Early Warning to load results.'); return; }
  resetAnalysisLayers();
  var updateDrought = buildRootZoneDroughtAlert(warningPanel, geom, request);
  var forecasts = ee.ImageCollection('ECMWF/NRT_FORECAST/IFS/OPER')
    .filter(ee.Filter.eq('model', 'ifs'))
    .filter(ee.Filter.gte('forecast_hours', 0))
    .filter(ee.Filter.lte('forecast_hours', 120));
  // Resolve availability on the client before creating any forecast layers.
  forecasts.aggregate_max('creation_time').evaluate(function(creation, error) {
    if (request !== warningRequestId) return;
    if (error || typeof creation !== 'number' || !isFinite(creation)) {
      status.setValue('No ECMWF forecast run is available. Root-zone monitoring may still be available.'); updateDrought(null); return;
    }
    var run = forecasts.filter(ee.Filter.eq('creation_time', creation)).sort('forecast_hours');
    run.aggregate_array('forecast_hours').evaluate(function(hours, hoursError) {
      if (request !== warningRequestId) return;
      if (hoursError || !hours || !hours.length) {
        status.setValue('The forecast run has no available steps.'); updateDrought(null); return;
      }
      var horizon = Math.max.apply(null, hours);
      status.setValue('ECMWF run: ' + new Date(creation).toUTCString() +
        '\nAvailable horizon: ' + horizon + ' hours | ' + hours.length + ' forecast steps');
      status.style().set('whiteSpace', 'pre-wrap');
      // Map directly over existing images: no assumed three-hour sequence or null first().
      var winds = run.map(function(image) {
        return image.select('u_component_of_wind_10m_sfc').pow(2)
          .add(image.select('v_component_of_wind_10m_sfc').pow(2)).sqrt().rename('wind_ms');
      });
      var temperatures = run.select('temperature_2m_sfc'); // IFS is already Celsius.
      // Precipitation is cumulative since forecast hour zero. Do not sum cumulative steps.
      var rain = run.select('total_precipitation_sfc').max().max(0).multiply(1000).rename('rain_mm').clip(geom);
      var wind = winds.max().clip(geom);
      var storm = rain.unitScale(25, 150).clamp(0, 1).multiply(0.7)
        .add(wind.unitScale(8, 25).clamp(0, 1).multiply(0.3)).rename('storm_score');
      var dayNumbers = ee.List(run.aggregate_array('forecast_hours')).map(function(hour) {
        return ee.Number(hour).divide(24).floor();
      }).distinct().sort();
      var dailyMaximums = ee.ImageCollection.fromImages(dayNumbers.map(function(day) {
        var startHour = ee.Number(day).multiply(24);
        return run.filter(ee.Filter.gte('forecast_hours', startHour))
          .filter(ee.Filter.lt('forecast_hours', startHour.add(24)))
          .select('temperature_2m_sfc').max().rename('daily_max_c');
      }));
      var hotDays = dailyMaximums.map(function(image) { return image.gte(35).rename('hot'); }).sum();
      var heat = temperatures.max().unitScale(30, 42).clamp(0, 1).multiply(0.7)
        .add(hotDays.unitScale(1, 5).clamp(0, 1).multiply(0.3)).rename('heatwave_score').clip(geom);
      var palette = ['0F766E', '8BC34A', 'FDD835', 'FB8C00', 'B71C1C'];
      Map.addLayer(storm, {min: 0, max: 1, palette: palette}, 'Storm potential', true);

      Map.addLayer(heat, {min: 0, max: 1, palette: palette}, 'Heatwave potential', false);
      addLegend('Storm potential', palette, ['Low', 'Moderate', 'Elevated', 'High', 'Very high'], 0, 1);
      function card(title, description, image, band) {
        var panel = ui.Panel({style: {padding: '8px', margin: '6px 0', backgroundColor: 'F1F5F9'}});
        panel.add(ui.Label(title, {fontWeight: 'bold', fontSize: '13px'}));
        var label = ui.Label('Calculating...', {fontWeight: 'bold', fontSize: '12px'});
        panel.add(label); panel.add(ui.Label(description, {fontSize: '10px', color: '64748B'}));
        warningPanel.add(panel);
        var region = image.reduceRegion({reducer: ee.Reducer.mean(), geometry: geom,
          scale: 28000, bestEffort: true, maxPixels: 1e8});
        var point = image.reduceRegion({reducer: ee.Reducer.first(), geometry: geom.centroid(100), scale: 28000});
        var score = ee.Algorithms.If(ee.Algorithms.IsEqual(region.get(band), null), point.get(band), region.get(band));
        ee.Dictionary({score: score}).evaluate(function(value, scoreError) {
          if (request !== warningRequestId) return;
          label.setValue(formatWarningScore(value && value.score, scoreError));
        });
      }
      card('⛈ STORM POTENTIAL', 'Cumulative rainfall and maximum wind over the available forecast horizon; this is not a daily rainfall warning.', storm, 'storm_score');
      updateDrought(run, hours, creation);
      card('🔥 HEATWAVE POTENTIAL', 'Maximum temperature and the number of forecast day bins above 35°C; consecutive-day persistence is not assessed.', heat, 'heatwave_score');
      addInfo('Early warning', ['Source: ECMWF IFS NRT.', 'Available horizon: ' + horizon + ' hours.',
        'Screening indicators; consult national meteorological alerts.']);
    });
  });
}


// ================================================================
// 14. TAB NAVIGATION
// ================================================================

var tabButtons = {};


function makeTabButton(
  key,
  labelText
) {

  var button =
    ui.Button({

      label:
        labelText,

      onClick:
        function() {

          showTab(
            key
          );

        },

      style: {

        fontSize: '10px',

        fontWeight:
          'bold',

        padding:
          '5px 6px',

        margin:
          '0 2px',

        backgroundColor:
          'CCFBF1'

      }

    });


  tabButtons[key] =
    button;


  tabBar.add(
    button
  );

}


makeTabButton(
  'soil',
  'SOIL'
);

makeTabButton(
  'suitability',
  'SUITABILITY'
);

makeTabButton(
  'weather',
  'CLIMATE'
);

makeTabButton(
  'monitoring',
  'MONITOR'
);

makeTabButton(
  'warning',
  'WARNINGS'
);


// ---------------------------------------------------------------
// ACTIVE TAB
// ---------------------------------------------------------------

function setActiveTab(
  key
) {

  Object.keys(
    tabButtons
  ).forEach(
    function(name) {

      tabButtons[name]
        .style()
        .set({

          backgroundColor:
            name === key
              ? '0F766E'
              : 'CCFBF1',

          color:
            name === key
              ? 'FFFFFF'
              : '263238'

        });

    }
  );

}


// ---------------------------------------------------------------
// SHOW TAB
// ---------------------------------------------------------------

function showTab(
  key
) {
  if(contentPanel.el)contentPanel.el.classList.toggle('sieg-hidden-monitoring-panel',key==='monitoring');
  warningRequestId++;
  moistureRequestId++;
  pestRequestId++;
  weatherRequestId++;
  cropRequestId++;
  clearWeatherMapPanel();
  if(key==='recommendations'){setActiveTab(key);buildRecommendationTab();return;}
  if(key==='yield'){setActiveTab(key);contentPanel.clear();return;}


  setActiveTab(
    key
  );


  if (
    key === 'soil'
  ) {

    buildSoilTab();

  }


  if (
    key === 'suitability'
  ) {

    buildSuitabilityTab();

  }


  if (
    key === 'weather'
  ) {

    buildWeatherTab();

  }


  if (
    key === 'monitoring'
  ) {

    buildCropMonitoringTab();

  }


  if (
    key === 'warning'
  ) {

    buildEarlyWarningTab();

  }

}


// ================================================================
// 15. INITIAL STATE
// ================================================================

showTab(
  'soil'
);


print(
  'SIEG Fields Dashboard loaded.'
);

print(
  'Draw a polygon and select an analysis from the five tabs.'
);

print('Current climate includes year-to-date observations; crop screening uses its labelled rolling 10-year baseline.');

print(
  'Early warning uses the latest available ECMWF IFS forecast run, which is labelled separately from observations.'
);
// Click a soil-texture pixel to see its USDA class name.
var soilTextureNames = ['Clay', 'Silty clay', 'Sandy clay', 'Clay loam', 'Silty clay loam', 'Sandy clay loam', 'Loam', 'Silt loam', 'Sandy loam', 'Silt', 'Loamy sand', 'Sand'];
Map.onClick(function(coords) {
  var textureVisible = false;
  for (var i = 0; i < Map.layers().length(); i++) {
    var layer = Map.layers().get(i);
    if (layer.getName() === 'Soil texture' && layer.getShown()) textureVisible = true;
  }
  if (!textureVisible) return;
  var label = ui.Label('Reading soil texture...', {fontSize: '12px', color: '0F766E'});
  mapInfoPanel.add(label);
  ee.Image('OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02').select('b0')
    .reduceRegion({reducer: ee.Reducer.first(), geometry: ee.Geometry.Point([coords.lon, coords.lat]), scale: 250})
    .evaluate(function(value, error) {
      var code = value && value.b0;
      label.setValue(!error && code >= 1 && code <= 12 ? 'Texture: ' + soilTextureNames[code - 1] : 'No soil-texture data here.');
    });
});

// Coarse climate grids can miss a small polygon's pixel centres. Keep true zeros;
// use the centroid source cell only when an area mean is actually missing.
function climateAreaStats(image,geom,scale,names) {
 var regional=image.reduceRegion({reducer:ee.Reducer.mean(),geometry:geom,scale:scale,crs:'EPSG:4326',bestEffort:true,maxPixels:1e8,tileScale:2});
 var point=image.reduceRegion({reducer:ee.Reducer.first(),geometry:geom.centroid(100),scale:scale,crs:'EPSG:4326',maxPixels:1e6});
 return ee.Dictionary.fromLists(names,ee.List(names).map(function(key){key=ee.String(key);var value=regional.get(key);return ee.Algorithms.If(ee.Algorithms.IsEqual(value,null),point.get(key),value);}));
}
// Current-year weather is distinct from the crop-selection climatological baseline.
function buildCurrentClimatePanel(geom) {
 var today=new Date(),currentYear=today.getUTCFullYear(),token=weatherRequestId;
 var panel=ui.Panel({style:{padding:'10px',backgroundColor:'FFFFFF'}});
 weatherMapPanel.add(panel);
 panel.add(ui.Label('YEAR TO DATE · '+currentYear,{fontWeight:'bold',color:'0F766E'}));
 var source=ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR').filterBounds(geom)
   .filterDate(ee.Date.fromYMD(currentYear,1,1),ee.Date(Date.now()));
 var latest=ui.Label('Checking latest published daily observations…',{fontSize:'11px'});panel.add(latest);
 source.aggregate_max('system:time_start').evaluate(function(v,error){
   if(token!==weatherRequestId)return;
   latest.setValue(error||!v?'Current daily weather is unavailable; no earlier year is substituted.':
    'Requested through '+today.toISOString().slice(0,10)+' | Latest ERA5-Land daily record: '+new Date(v).toISOString().slice(0,10)+'. Partial year; publication lag applies.');
 });
 panel.add(ui.Label('Regional climate context (~11 km): small boundaries use the centroid source cell when no area mean is available. Missing source observations remain unavailable.',{fontSize:'11px'}));
 var fc=ee.FeatureCollection(ee.List.sequence(1,today.getUTCMonth()+1).map(function(month){
  var start=ee.Date.fromYMD(currentYear,month,1),end=ee.Date(ee.Number(start.advance(1,'month').millis()).min(Date.now()));
  var col=source.filterDate(start,end),seed=ee.Image.constant([0,0]).rename(['total_precipitation_sum','temperature_2m']).toDouble().updateMask(ee.Image(0));
  var normalized=col.select(['total_precipitation_sum','temperature_2m']).map(function(im){return im.toDouble();}).merge(ee.ImageCollection.fromImages([seed]));
  var image=normalized.select('total_precipitation_sum').sum().multiply(1000).rename('rain_mm')
   .addBands(normalized.select('temperature_2m').mean().subtract(273.15).rename('temp_c'));
  var stats=climateAreaStats(image,geom,11132,['rain_mm','temp_c']);
  return ee.Feature(null,ee.Algorithms.If(col.size().gt(0),stats,ee.Dictionary({rain_mm:null,temp_c:null})))
   .set({month:start.format('MMM'),source_days:col.size()});
 }));
 [['rain_mm','Year-to-date monthly rainfall','mm'],['temp_c','Current-year monthly temperature','°C']].forEach(function(spec){
  panel.add(ui.Chart.feature.byFeature(fc,'month',[spec[0]]).setOptions({title:spec[1],vAxis:{title:spec[2]},colors:['#218b8c'],height:220}));
 });
}
