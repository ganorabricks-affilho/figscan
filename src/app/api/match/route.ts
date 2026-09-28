import { NextResponse } from "next/server";
import { getCatalogSource, getMinifigIndex } from "@/lib/catalog/index";
import { embedFromDataUrl, embedImage } from "@/lib/embeddings";
import { nearestNeighbors } from "@/lib/match/search";
import type { MatchResponse } from "@/lib/catalog/types";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const started = Date.now();

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let imageBuffer: Buffer | null = null;
    let providerResult: Awaited<ReturnType<typeof embedImage>>;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("image");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Upload an image file under the `image` field." },
          { status: 400 },
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: "Image must be under 8 MB." },
          { status: 400 },
        );
      }
      imageBuffer = Buffer.from(await file.arrayBuffer());
      providerResult = await embedImage(imageBuffer);
    } else {
      const body = (await request.json()) as { imageDataUrl?: string; k?: number };
      if (!body.imageDataUrl) {
        return NextResponse.json(
          { error: "Provide `imageDataUrl` (base64 data URL) or multipart `image`." },
          { status: 400 },
        );
      }
      if (body.imageDataUrl.length > MAX_BYTES * 1.4) {
        return NextResponse.json(
          { error: "Image must be under 8 MB." },
          { status: 400 },
        );
      }
      providerResult = await embedFromDataUrl(body.imageDataUrl);
    }

    const index = await getMinifigIndex();
    const matches = nearestNeighbors(providerResult.embedding, index, 5);

    const payload: MatchResponse = {
      matches,
      embeddingProvider: providerResult.provider,
      catalogSource: getCatalogSource(),
      elapsedMs: Date.now() - started,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Match API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not match that image. Try another photo.",
      },
      { status: 500 },
    );
  }
}
