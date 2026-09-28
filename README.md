# ScanFig

Identify LEGO minifigures from a camera capture or uploaded photo. ScanFig embeds the image, runs nearest-neighbor search against a local BrickLink-backed minifig index, and returns top matches with catalog ID, name, image, confidence, BrickLink link, and price when available.

## Architecture (cost model)

```
User photo → image embedding → vector NN top-k → BrickLink metadata / price → UI
```

- **Catalog match itself is ~$0 / scan** when metadata is cached and you look up by ID after visual match. BrickLink’s API is currently free (rate-limited); do not scrape.
- **Vision is the real per-scan cost.** Hosted CLIP-style embed + NN is typically **~$0.0002–$0.001 / scan**. This MVP defaults to a **free local feature embedding** so demos run with zero paid keys; optional OpenAI / Replicate hooks activate when env vars are set.
- One-time index build for ~19k figs is a fixed cost (hosted CLIP roughly **$4–$20**); the MVP ships a **32-figure mock index** for local demos.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.

## Quick start

```bash
npm install
npm run build:index   # writes public/catalog/*.svg + data/minifig-index.json
npm run dev           # http://127.0.0.1:43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127). Use the camera, upload a photo, or tap a sample figure.

## Environment variables

All optional. The app works out of the box on the mock catalog + local embeddings.

| Variable | Purpose |
| --- | --- |
| `BRICKLINK_CONSUMER_KEY` | BrickLink API consumer key |
| `BRICKLINK_CONSUMER_SECRET` | BrickLink API consumer secret |
| `BRICKLINK_TOKEN_VALUE` | BrickLink token value |
| `BRICKLINK_TOKEN_SECRET` | BrickLink token secret |
| `OPENAI_API_KEY` | Optional hosted path (text signature embed); requires `SCANFIG_FORCE_OPENAI=1` + index rebuilt in that space |
| `OPENAI_EMBEDDING_MODEL` | Optional OpenAI model (default `text-embedding-3-small`) |
| `SCANFIG_FORCE_OPENAI` | Set `1` to use OpenAI instead of local (demo default stays local) |
| `REPLICATE_API_TOKEN` | Optional Replicate CLIP-style embeddings |
| `REPLICATE_EMBEDDING_MODEL` | Optional Replicate model slug |
| `REPLICATE_EMBEDDING_VERSION` | Optional Replicate model version hash |
| `SCANFIG_FORCE_REPLICATE` | Set `1` to use Replicate instead of local |

Copy `.env.example` to `.env.local` when you have credentials. BrickLink enrichment uses the **official Catalog API only** (OAuth 1.0a) — no scraping.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server on port **43127** |
| `npm run build:index` | Rebuild mock SVGs + local embedding index |
| `npm run build` | Production build |
| `npm run start` | Production server (set `-p 43127` if desired) |
| `npm run lint` | ESLint |

## API

### `POST /api/match`

JSON body:

```json
{ "imageDataUrl": "data:image/jpeg;base64,..." }
```

Or `multipart/form-data` with an `image` file.

Response includes `matches[]` (`id`, `name`, `imageUrl`, `confidence`, `bricklinkUrl`, `priceUsd`, …), `embeddingProvider`, `catalogSource`, and `elapsedMs`.

### `GET /api/catalog`

Lists the demo catalog (without embedding vectors).

## Notes

- Monetize identification / camera / UX — not “access to BrickLink data” (see BrickLink API Terms).
- Mock figures use stylized placeholder art so matching works without catalog image downloads.
