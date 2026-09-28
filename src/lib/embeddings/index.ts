import sharp from "sharp";
import { bufferFromDataUrl, embedLocal, l2Normalize } from "./local";

export type EmbeddingProvider = "local" | "openai" | "replicate";

export async function embedImage(
  imageBuffer: Buffer,
): Promise<{ embedding: number[]; provider: EmbeddingProvider }> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const embedding = await embedOpenAI(imageBuffer);
      return { embedding, provider: "openai" };
    } catch (error) {
      console.warn("OpenAI embedding failed, falling back to local:", error);
    }
  }

  if (process.env.REPLICATE_API_TOKEN) {
    try {
      const embedding = await embedReplicate(imageBuffer);
      return { embedding, provider: "replicate" };
    } catch (error) {
      console.warn("Replicate embedding failed, falling back to local:", error);
    }
  }

  const embedding = await embedLocal(imageBuffer);
  return { embedding, provider: "local" };
}

export async function embedFromDataUrl(dataUrl: string) {
  const buffer = await bufferFromDataUrl(dataUrl);
  return embedImage(buffer);
}

/**
 * OpenAI has no first-class CLIP image embed in the standard embeddings API.
 * MVP hook: derive a compact visual signature with sharp, embed that text vector,
 * then pad/truncate to align with the local index only when the whole index was
 * also built with OpenAI (otherwise we fall back to local so NN stays consistent).
 *
 * For demos without keys, local embeddings are used end-to-end.
 */
async function embedOpenAI(imageBuffer: Buffer): Promise<number[]> {
  // Prefer local for consistency with the prebuilt mock index unless explicitly forced.
  if (process.env.SCANFIG_FORCE_OPENAI !== "1") {
    throw new Error("OpenAI skipped — local index expects local vectors (set SCANFIG_FORCE_OPENAI=1 to override)");
  }

  const signature = await visualSignature(imageBuffer);
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      input: signature,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI embeddings error: ${res.status}`);
  }

  const json = (await res.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return l2Normalize(json.data[0].embedding);
}

/**
 * Optional Replicate CLIP hook. Only used when SCANFIG_FORCE_REPLICATE=1 so
 * query vectors stay in the same space as the shipped local index by default.
 */
async function embedReplicate(imageBuffer: Buffer): Promise<number[]> {
  if (process.env.SCANFIG_FORCE_REPLICATE !== "1") {
    throw new Error("Replicate skipped — local index expects local vectors");
  }

  const model =
    process.env.REPLICATE_EMBEDDING_MODEL ?? "krthr/clip-embeddings";
  const dataUrl = `data:${detectMime(imageBuffer)};base64,${imageBuffer.toString("base64")}`;

  const body: Record<string, unknown> = {
    input: { image: dataUrl },
  };
  if (process.env.REPLICATE_EMBEDDING_VERSION) {
    body.version = process.env.REPLICATE_EMBEDDING_VERSION;
  } else {
    body.model = model;
  }

  const create = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify(body),
  });

  if (!create.ok) {
    throw new Error(`Replicate error: ${create.status}`);
  }

  const prediction = (await create.json()) as {
    output?: number[] | { embedding?: number[] };
  };

  const output = prediction.output;
  if (Array.isArray(output)) return l2Normalize(output);
  if (output && Array.isArray(output.embedding)) {
    return l2Normalize(output.embedding);
  }
  throw new Error("Replicate response missing embedding");
}

async function visualSignature(imageBuffer: Buffer): Promise<string> {
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize(4, 4, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cells: string[] = [];
  for (let i = 0; i < 16; i++) {
    const o = i * info.channels;
    cells.push(
      `${Math.round(data[o] / 32)}${Math.round(data[o + 1] / 32)}${Math.round(data[o + 2] / 32)}`,
    );
  }
  return `minifig visual grid ${cells.join(" ")}`;
}

function detectMime(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x52 && buf[1] === 0x49) return "image/webp";
  const head = buf.toString("utf8", 0, 64).toLowerCase();
  if (head.includes("svg") || buf[0] === 0x3c) return "image/svg+xml";
  return "image/jpeg";
}
