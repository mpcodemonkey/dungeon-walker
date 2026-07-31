function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: process.env.PORT ?? '3000',
  jwtSecret: requireEnv('JWT_SECRET'),
  // Local path to the .pmtiles map data file. Not required at startup —
  // the /tiles route just 500s until this points at a real file. See
  // docs/maplibre-migration.md for how to get one.
  pmtilesPath: process.env.PMTILES_PATH ?? './tiles/map.pmtiles',
};
