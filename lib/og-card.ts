import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The share card's dimensions, read off the committed PNG.
 *
 * `app/layout.tsx` used to state 1200 and 630 by hand. Nothing checked them
 * against the file, so re-exporting the card at another size would have
 * published two numbers describing an image that no longer had them -- the
 * ordinary shape of this portfolio's dominant defect, a number that describes
 * nothing. The IHDR chunk of a PNG puts width and height at a fixed offset, so
 * the file can simply be asked.
 *
 * This runs at build time only: the static export prerenders every page, and
 * nothing here reaches a browser bundle.
 */
function readPngSize(file: string): { width: number; height: number } {
  const header = readFileSync(file).subarray(0, 24);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!header.subarray(0, 8).equals(signature)) {
    throw new Error(`${file} is not a PNG`);
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

export const ogCard = readPngSize(join(process.cwd(), "public", "og.png"));
