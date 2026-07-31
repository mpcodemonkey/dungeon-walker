import { layers, LIGHT } from '@protomaps/basemaps';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { requireApiUrl } from '../api/client';

const SOURCE_NAME = 'protomaps';

// Fallback if /tiles/metadata is unreachable (e.g. the server has no
// .pmtiles file configured yet) — a typical zoom range for a stock
// Protomaps basemap build, just so the app doesn't crash. Real archives
// report their actual value via /tiles/metadata; this is only a guess.
const FALLBACK_MAXZOOM = 15;

async function fetchTileMaxZoom(apiUrl: string): Promise<number> {
  try {
    const response = await fetch(`${apiUrl}/tiles/metadata`);
    if (!response.ok) return FALLBACK_MAXZOOM;
    const metadata = (await response.json()) as { maxzoom?: number };
    return typeof metadata.maxzoom === 'number' ? metadata.maxzoom : FALLBACK_MAXZOOM;
  } catch {
    return FALLBACK_MAXZOOM;
  }
}

// Self-hosted Protomaps vector tiles served by our own server (see
// server/src/routes/tiles.ts and docs/maplibre-migration.md). No text
// labels yet: that needs a `glyphs` URL (font stack) we don't have, so
// symbol layers from @protomaps/basemaps are included but won't render
// text until that's added.
//
// The vector source's `maxzoom` must match the .pmtiles archive's real
// highest stored zoom (read from our own /tiles/metadata, not guessed).
// Set it too high and MapLibre requests tiles the archive doesn't have
// past that zoom — every one comes back empty, so the map goes blank
// once you zoom in past the archive's real data, instead of correctly
// reusing and scaling up the highest-resolution tile it already has.
export async function buildMapStyle(): Promise<StyleSpecification> {
  const apiUrl = requireApiUrl();
  const maxzoom = await fetchTileMaxZoom(apiUrl);

  return {
    version: 8,
    sources: {
      [SOURCE_NAME]: {
        type: 'vector',
        tiles: [`${apiUrl}/tiles/{z}/{x}/{y}.pbf`],
        maxzoom,
      },
    },
    layers: layers(SOURCE_NAME, LIGHT),
  };
}
