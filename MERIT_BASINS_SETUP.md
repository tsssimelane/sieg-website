# Automatic local catchment lookup

The current-location button uses the geolocation point, not the entire viewport or country. HydroBASINS L1 (`WWF/HydroSHEDS/v1/Basins/hybas_1`) identifies the Pfafstetter regional code in a 30 m search tolerance. Only the corresponding configured MERIT continental table is opened, with `filterBounds` applied before any merge or aggregation. At a regional seam, only the already-filtered local subsets are combined.

The next request returns one full polygon and COMID/unitarea, preferring a polygon containing the point; otherwise it selects the lowest COMID within the 30 m tolerance. No clipping or catchment dissolve is performed. This is the local **unit catchment**, not a delineation of the full upstream drainage area. The 30 m tolerance does not describe GPS or dataset accuracy.

## Configured assets

All IDs share `projects/ee-gee023/assets/`:

- cat_pfaf_1_MERIT_Hydro_v07_Basins_v01 — Africa
- cat_pfaf_2_MERIT_Hydro_v07_Basins_v01 — Europe
- cat_pfaf_4_MERIT_Hydro_v07_Basins_v01 — South Asia
- cat_pfaf_5_MERIT_Hydro_v07_Basins_v01 — Oceania and South Asian islands
- cat_pfaf_6_MERIT_Hydro_v07_Basins_v01 — South America
- cat_pfaf_7_MERIT_Hydro_v07_Basins_v01 — North America
- cat_pfaf_8_MERIT_Hydro_v07_Basins_v01 — Arctic region
- cat_pfaf_9_MERIT_Hydro_v07_Basins_v01 — Greenland

Region 3 (North Asia) was not supplied. There is no silent substitution: unavailable regions offer manual boundary upload. HydroBASINS L9 remains a separate optional map-only overview and does not change the analysis AOI.

## Configuration and access

`GEE_MERIT_BASINS_ASSETS` is a JSON object mapping regional codes to exact table IDs. Defaults and production/staging Wrangler configuration use the eight IDs above. Invalid configuration fails closed. The legacy singular variable is supported only as an explicit compatibility override; it is removed from the current production configuration.

Grant the configured Earth Engine service-account email Reader access to every table. Preserve COMID and unitarea (km²). Keep credentials server-side. Test known locations in each provided region using the deployed identity; automated fixtures do not verify asset ACLs or schema.

## Computation and reuse

A new covered location uses two bounded value requests: region identifiers, then one local catchment feature. It does not merge continental tables, aggregate national catchments or download neighbouring polygon lists. The complete returned polygon is attached locally, so outlining it does not require another EE geometry request. Up to eight resolved catchments are retained in browser memory; a repeat point inside a cached polygon reuses it without EE lookup. Cache identity includes the configured asset map, and point-in-polygon checks respect holes and multipart geometry. Late responses cannot replace an uploaded or newer AOI.

Ordinary processing limits remain 500 ha for Hydrology, 50 ha for Fields/Irrigate/Eco, and 5 ha/three map layers for the one-product pilot. Larger resolved unit catchments remain context-only; boundaries are never silently clipped. Admin Toolbox processing is separate. Boundary detection does not itself launch a paid scientific analysis.

Sources: https://www.reachhydro.org/home/params/merit-basins and https://developers.google.com/earth-engine/datasets/catalog/WWF_HydroSHEDS_v1_Basins_hybas_1 . Preserve source credits and applicable licences for the actual uploaded derivatives.
