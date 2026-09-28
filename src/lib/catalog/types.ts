export type MinifigRecord = {
  id: string;
  name: string;
  theme: string;
  year: number;
  imageUrl: string;
  bricklinkUrl: string;
  priceUsd: number | null;
  colors: [string, string, string];
  accent: string;
};

export type IndexedMinifig = MinifigRecord & {
  embedding: number[];
};

export type MatchResult = {
  id: string;
  name: string;
  theme: string;
  year: number;
  imageUrl: string;
  bricklinkUrl: string;
  priceUsd: number | null;
  confidence: number;
  distance: number;
};

export type MatchResponse = {
  matches: MatchResult[];
  embeddingProvider: "local" | "openai" | "replicate";
  catalogSource: "mock" | "bricklink-enriched";
  elapsedMs: number;
};
