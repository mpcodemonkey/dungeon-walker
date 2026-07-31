import { layers, LIGHT } from '@protomaps/basemaps';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { requireApiUrl } from '../api/client';

const SOURCE_NAME = 'protomaps';

// Self-hosted Protomaps vector tiles served by our own server (see
// server/src/routes/tiles.ts and docs/maplibre-migration.md). No text
// labels yet: that needs a `glyphs` URL (font stack) we don't have, so
// symbol layers from @protomaps/basemaps are included but won't render
// text until that's added.
export function buildMapStyle(): StyleSpecification {
  const apiUrl = requireApiUrl();

  return {
    version: 8,
    sources: {
      [SOURCE_NAME]: {
        type: 'vector',
        tiles: [`${apiUrl}/tiles/{z}/{x}/{y}.pbf`],
      },
    },
    layers: layers(SOURCE_NAME, LIGHT),
  };
}
