import { Router } from 'express';
import { PMTiles } from 'pmtiles';
import { env } from '../lib/env';
import { NodeFileSource } from '../lib/pmtilesSource';

export const tilesRouter = Router();

let pmtiles: PMTiles | undefined;

function getPmtiles(): PMTiles {
  pmtiles ??= new PMTiles(new NodeFileSource(env.pmtilesPath));
  return pmtiles;
}

function parseTileParam(raw: string, suffix: string): number | undefined {
  if (!raw.endsWith(suffix)) return undefined;
  const value = Number(raw.slice(0, -suffix.length));
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

// Real zoom range/bounds baked into the configured .pmtiles archive, so
// the client can build an accurate vector source instead of guessing a
// maxzoom — a mismatch there means the client requests tiles past what
// the archive actually has (every one comes back empty) instead of
// correctly over-zooming the highest real tile it already has.
tilesRouter.get('/metadata', async (_req, res) => {
  try {
    const header = await getPmtiles().getHeader();
    res.set('Cache-Control', 'public, max-age=86400');
    res.json({
      minzoom: header.minZoom,
      maxzoom: header.maxZoom,
      bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
    });
  } catch {
    res.status(500).json({ error: 'Failed to read tile metadata' });
  }
});

// No auth — map tiles aren't player-specific data. See
// docs/maplibre-migration.md for why this proxies a local .pmtiles file
// instead of having the client read it directly.
tilesRouter.get('/:z/:x/:y', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = parseTileParam(req.params.y, '.pbf');

  if (!Number.isInteger(z) || z < 0 || !Number.isInteger(x) || x < 0 || y === undefined) {
    res.status(400).json({ error: 'Invalid tile coordinates' });
    return;
  }

  try {
    const result = await getPmtiles().getZxy(z, x, y);
    if (!result) {
      res.status(204).end();
      return;
    }
    res.set('Content-Type', 'application/x-protobuf');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(result.data));
  } catch {
    res.status(500).json({ error: 'Failed to read tile data' });
  }
});
