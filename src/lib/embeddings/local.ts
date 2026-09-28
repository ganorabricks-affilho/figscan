import sharp from "sharp";

const GRID = 16;
const HIST_BINS = 8;

/**
 * Local image embedding for MVP demos (no API keys).
 * Combines a downsampled RGB grid with coarse color histograms so
 * visually similar minifigs land near each other in cosine space.
 */
export async function embedLocal(imageBuffer: Buffer): Promise<number[]> {
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize(GRID, GRID, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels < 3) {
    throw new Error("Expected RGB image data");
  }

  const grid: number[] = [];
  const histR = new Array(HIST_BINS).fill(0);
  const histG = new Array(HIST_BINS).fill(0);
  const histB = new Array(HIST_BINS).fill(0);
  const histL = new Array(HIST_BINS).fill(0);
  const pixels = GRID * GRID;

  for (let i = 0; i < pixels; i++) {
    const offset = i * info.channels;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    grid.push(r, g, b, lum);

    histR[Math.min(HIST_BINS - 1, Math.floor(r * HIST_BINS))] += 1;
    histG[Math.min(HIST_BINS - 1, Math.floor(g * HIST_BINS))] += 1;
    histB[Math.min(HIST_BINS - 1, Math.floor(b * HIST_BINS))] += 1;
    histL[Math.min(HIST_BINS - 1, Math.floor(lum * HIST_BINS))] += 1;
  }

  const hist = [...histR, ...histG, ...histB, ...histL].map((v) => v / pixels);
  return l2Normalize([...grid, ...hist]);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

export async function bufferFromDataUrl(dataUrl: string): Promise<Buffer> {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a base64 data URL");
  }
  return Buffer.from(match[2], "base64");
}
