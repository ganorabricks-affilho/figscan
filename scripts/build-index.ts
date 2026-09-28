/**
 * Rebuilds public/catalog SVGs and data/minifig-index.json with local embeddings.
 * Run: npm run build:index
 */
import { buildMinifigIndex } from "../src/lib/catalog/build-index";

async function main() {
  const result = await buildMinifigIndex();
  console.log(
    `Built index with ${result.count} minifigs (source=${result.source}, dims=${result.items[0]?.embedding.length ?? 0})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
