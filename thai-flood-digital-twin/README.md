# TH Flood Digital Twin

A public-facing Thailand 3D flood / storm visualization MVP deployed on Vercel.

## What is real data vs simulation

**Real/public data adapters and references**
- Thai Meteorological Department (TMD) GTS public REST warning endpoint.
- GISTDA Disaster Platform / data.go.th flood catalog (STAC, WMS, WMTS, TMS). API key required for production integration.
- Department of Water Resources (DWR) datasets published to data.go.th under the Thaiwater Standard.
- Google Flood Forecasting API / Flood Hub. API key + service access required. Historical products include GRRR (1980–2023) and Inundation History (1999–2020).

**Simulation**
- Blue flood polygons, water depth, storm motion, hydrograph and 24-hour playback are explicitly labelled as scenario visualization in this MVP. They are not official observed measurements.

## Production hardening

1. Add Vercel server-side proxy routes for TMD/GISTDA/Google.
2. Put secrets in Vercel Environment Variables.
3. Cache official data with source timestamps and provenance.
4. Add PostGIS/Supabase for historical province/basin indexing.
5. Replace scenario flood polygons with official GISTDA/Google inundation geometry where licensing/coverage permits.
6. Add DEM terrain, river basins, drainage and gauge station layers.
7. Add model versioning and uncertainty bands for forecasts.

## Front end
Static MapLibre GL application using OpenFreeMap as basemap, with 3D-building attempt where the vector style exposes a building source layer.
