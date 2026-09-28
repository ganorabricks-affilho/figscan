import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { MOCK_MINIFIGS } from "@/lib/catalog/mock-data";
import { renderMinifigSvg } from "@/lib/catalog/svg";
import type { IndexedMinifig, MinifigRecord } from "@/lib/catalog/types";
import { embedLocal } from "@/lib/embeddings/local";

const DATA_DIR = path.join(process.cwd(), "data");
const INDEX_PATH = path.join(DATA_DIR, "minifig-index.json");
const CATALOG_DIR = path.join(process.cwd(), "public", "catalog");

export type IndexFile = {
  builtAt: string;
  provider: "local";
  source: "mock" | "bricklink-enriched";
  count: number;
  items: IndexedMinifig[];
};

export async function buildMinifigIndex(
  figs: MinifigRecord[] = MOCK_MINIFIGS,
  source: "mock" | "bricklink-enriched" = "mock",
): Promise<IndexFile> {
  await mkdir(CATALOG_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  const items: IndexedMinifig[] = [];

  for (const fig of figs) {
    const svg = renderMinifigSvg(fig);
    const svgPath = path.join(CATALOG_DIR, `${fig.id}.svg`);
    await writeFile(svgPath, svg, "utf8");

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const embedding = await embedLocal(png);

    items.push({
      ...fig,
      embedding,
    });
  }

  const payload: IndexFile = {
    builtAt: new Date().toISOString(),
    provider: "local",
    source,
    count: items.length,
    items,
  };

  await writeFile(INDEX_PATH, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function readIndexFile(): Promise<IndexFile | null> {
  try {
    const raw = await readFile(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw) as IndexFile;
    if (parsed.items?.length) return parsed;
    return null;
  } catch {
    return null;
  }
}

export { INDEX_PATH, DATA_DIR, CATALOG_DIR };
