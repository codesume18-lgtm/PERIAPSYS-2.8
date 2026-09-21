# SAR Earth Explorer — PERIAPSYS

NASA-inspired interactive web experience for the “Dancing with the SARs” challenge.

## Run in VS Code

Requirements:

- Node.js 20+
- pnpm 9+

From the project root:

```bash
pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/sar-earth-explorer run dev
```

Then open:

```text
http://localhost:5173
```

On Windows PowerShell, set the variables first:

```powershell
$env:PORT="5173"
$env:BASE_PATH="/"
pnpm --filter @workspace/sar-earth-explorer run dev
```

## Routes

- `/` — challenge landing page
- `/explore` — interactive Earth explorer

## Included interactions

- Story switching between flood, glacier, and agriculture examples
- Pointer-driven real 3D globe rotation when WebGL is available
- NASA GIBS Blue Marble Earth texture
- Color Earth rendering with monochrome mission-control UI
- Radar, optical reference, change detection, and orbit layer toggles
- Curated NISAR teaching locations plus selectable live NASA EONET event points
- Observation timeline scrubbing
- Responsive mobile controls

## Live data sources

- NASA Earthdata CMR for NISAR collection and granule metadata
- NASA EONET for current natural-event context and world event coordinates
- NASA GIBS for the Earth texture
- NASA Image and Video Library API for live satellite, solar, and spacecraft imagery
- Official ISRO NISAR mission page and DRDO portal links for agency context

## API path to a fully functional NISAR tracker

The production version should use these real services:

1. **NASA Earthdata CMR** — discover NISAR collections and granules by time, location, and product type:
   `https://cmr.earthdata.nasa.gov/search/`
2. **NASA Earthdata Login** — authenticate users before downloading protected NISAR science products:
   `https://urs.earthdata.nasa.gov/`
3. **NASA Earthdata NISAR access tools / ASF Search API** — search and download actual NISAR SAR products for a selected area and time window:
   `https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/nisar/data-access-tools`
4. **NASA GIBS** — render satellite imagery layers and time slices:
   `https://earthdata.nasa.gov/gibs`
5. **NASA EONET** — provide current global event coordinates that can become candidate NISAR observation targets:
   `https://eonet.gsfc.nasa.gov/api/v3/events`
6. **NASA Image and Video Library API** — provide the live landing-page satellite, solar, and spacecraft visuals:
   `https://images-api.nasa.gov/search`

The current explorer already uses CMR, EONET, GIBS, and the Image Library API. The story cards remain curated educational examples, while live EONET points are marked separately. Actual NISAR change detection requires Earthdata authentication plus product downloads and a processing step for backscatter, coherence, or displacement. ISRO and DRDO do not expose one stable public browser API for those reports, so the app links to their official sources rather than fabricating a live feed.