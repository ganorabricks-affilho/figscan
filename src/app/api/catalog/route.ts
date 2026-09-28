import { NextResponse } from "next/server";
import { MOCK_MINIFIGS } from "@/lib/catalog/mock-data";
import { getCatalogSource, getMinifigIndex } from "@/lib/catalog/index";

export const runtime = "nodejs";

export async function GET() {
  // Ensure catalog SVGs + index exist for the UI sample strip.
  await getMinifigIndex();

  return NextResponse.json({
    source: getCatalogSource(),
    count: MOCK_MINIFIGS.length,
    items: MOCK_MINIFIGS.map((fig) => ({
      id: fig.id,
      name: fig.name,
      theme: fig.theme,
      year: fig.year,
      imageUrl: fig.imageUrl,
      bricklinkUrl: fig.bricklinkUrl,
      priceUsd: fig.priceUsd,
    })),
  });
}
