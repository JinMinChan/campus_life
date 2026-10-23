# Data, dependencies and visual references

## OpenStreetMap

© OpenStreetMap contributors. OpenStreetMap is available under the Open Data Commons Open Database License 1.0 (ODbL).

- Copyright and attribution: https://www.openstreetmap.org/copyright
- Full data license: https://opendatacommons.org/licenses/odbl/1-0/
- Source request: https://www.openstreetmap.org/api/0.6/map?bbox=127.037,37.553,127.051,37.562
- Retrieved: 2026-10-23
- Campus boundary: https://www.openstreetmap.org/way/187645257
- Original extract: `data/osm-map.xml`
- Derived database: `public/data/campus.json` (ODbL 1.0)
- Transformations: local metric projection, campus filtering, footprint/name/height extraction, clipped road segments, and source metadata. OSM source way IDs remain in the derivative. No OSM map tiles are used.

## Terrain

Terrain Tiles was accessed on 2026-10-23 from https://registry.opendata.aws/terrain-tiles/.

Mapzen / Tilezen Terrain Tiles, Terrarium encoding. Regional terrain uses SRTM data courtesy of the U.S. Geological Survey. Attribution and underlying source terms: https://github.com/tilezen/joerd/blob/master/docs/attribution.md

- https://s3.amazonaws.com/elevation-tiles-prod/terrarium/14/13973/6345.png
- https://s3.amazonaws.com/elevation-tiles-prod/terrarium/14/13974/6345.png
- Transformations: bilinear sampling into a 20m local grid; rendering as a stylized campus island. This rendering is not a survey or a navigation product.

## Three.js

Three.js r170 and its OrbitControls addon are distributed under the MIT License. Copyright 2010–2024 Three.js Authors. License text: `public/vendor/THREE-LICENSE.txt`.

Downloaded from the official Three.js npm package via jsDelivr. Both runtime files are stored locally; the game has no CDN dependency.

## Independently created assets and code

All game logic, UI, building materials/details, student meshes, tree meshes, ground geometry and procedural decoration were created for this game. The license in `LICENSE` applies to these project-authored code files only. It does not replace the data or dependency licenses above.

The Hanyang University name and building names identify a real place. This is an unofficial prototype with no university affiliation.

## Visual references, viewed but not bundled in the game

- SMASH EWHA: https://hong-iron.github.io/SMASH-EWHA/ and its public share image https://hong-iron.github.io/SMASH-EWHA/og.png — reference for the high oblique camera only. No SMASH source code, campus data, models or textures were copied.
- Tiny Glade official Steam page and official screenshot: https://store.steampowered.com/app/2198150/Tiny_Glade/ — reference for warm colors, soft shadows and diorama atmosphere. No Tiny Glade assets were copied.
- Hanyang official campus map page: https://www.hanyang.ac.kr/map_seoul — consulted for campus context; no map artwork was copied.

Local `artifacts/reference-*` images were retained solely as research references and are not runtime assets or covered by the project's MIT License. They are excluded from the delivery archive.

Landmark appearance references consulted for the upgrade (no photographs copied into the game): Hanyang History Museum gallery https://historymuseum.hanyang.ac.kr/front/gallery/life/3/1 and Hanyang Wiki, Baeknam Library https://hyu.wiki/백남학술정보관.
