import { open, type FileHandle } from 'node:fs/promises';
import type { Source, RangeResponse } from 'pmtiles';

// pmtiles' own Source implementations are browser-only (File API,
// fetch). This is the Node/fs equivalent, reading byte ranges directly
// off disk. See docs/maplibre-migration.md.
export class NodeFileSource implements Source {
  constructor(private readonly filePath: string) {}

  getKey(): string {
    return this.filePath;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    let handle: FileHandle | undefined;
    try {
      handle = await open(this.filePath, 'r');
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, offset);
      return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
    } finally {
      await handle?.close();
    }
  }
}
