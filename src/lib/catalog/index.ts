import "server-only";
import { MOCK_MINIFIGS } from "@/lib/catalog/mock-data";
import {
  buildMinifigIndex,
  readIndexFile,
  type IndexFile,
} from "@/lib/catalog/build-index";
import type { IndexedMinifig, MinifigRecord } from "@/lib/catalog/types";
import { enrichFromBrickLink } from "@/lib/bricklink/client";

let cachedIndex: IndexedMinifig[] | null = null;
let catalogSource: "mock" | "bricklink-enriched" = "mock";

export function getCatalogSource() {
  return catalogSource;
}

export async function getMinifigIndex(): Promise<IndexedMinifig[]> {
  if (cachedIndex) return cachedIndex;

  const existing = await readIndexFile();
  if (existing) {
    cachedIndex = existing.items;
    catalogSource = existing.source;
    return cachedIndex;
  }

  const built = await rebuildIndex();
  cachedIndex = built.items;
  catalogSource = built.source;
  return cachedIndex;
}

export async function rebuildIndex(): Promise<IndexFile> {
  const { figs, enriched } = await enrichFromBrickLink(MOCK_MINIFIGS);
  const built = await buildMinifigIndex(
    figs,
    enriched ? "bricklink-enriched" : "mock",
  );
  cachedIndex = built.items;
  catalogSource = built.source;
  return built;
}

export function listCatalogWithoutEmbeddings(): MinifigRecord[] {
  return MOCK_MINIFIGS.map((fig) => ({ ...fig }));
}
