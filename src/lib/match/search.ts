import { cosineSimilarity } from "@/lib/embeddings/local";
import type { IndexedMinifig, MatchResult } from "@/lib/catalog/types";

export function nearestNeighbors(
  query: number[],
  index: IndexedMinifig[],
  k = 5,
): MatchResult[] {
  const scored = index.map((item) => {
    const similarity = cosineSimilarity(query, item.embedding);
    const distance = 1 - similarity;
    const confidence = Math.max(0, Math.min(0.99, (similarity + 1) / 2));
    return {
      id: item.id,
      name: item.name,
      theme: item.theme,
      year: item.year,
      imageUrl: item.imageUrl,
      bricklinkUrl: item.bricklinkUrl,
      priceUsd: item.priceUsd,
      confidence,
      distance,
    } satisfies MatchResult;
  });

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored.slice(0, k);
}
