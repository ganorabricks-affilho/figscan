import { ScanStudio } from "@/components/scan/scan-studio";

export default function Home() {
  return (
    <div className="scanfig-shell">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pb-2 pt-6 sm:px-8 sm:pt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
          Catalog vision MVP
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Embeddings + NN
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 pb-16 pt-4 sm:px-8">
        <section className="space-y-4 pt-2 sm:pt-4">
          <h1 className="brand-mark font-display text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
            ScanFig
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Identify LEGO minifigures from a camera or upload. Matched against a
            BrickLink-backed index — catalog lookup stays near{" "}
            <span className="text-teal-300">$0 per scan</span>; vision is the
            cost.
          </p>
        </section>

        <ScanStudio />

        <section className="grid gap-6 border-t border-white/10 pt-10 sm:grid-cols-3">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-300/80">
              01 · Capture
            </p>
            <p className="text-sm leading-relaxed text-slate-400">
              Live camera on desktop and mobile, or a direct photo upload.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-300/80">
              02 · Embed
            </p>
            <p className="text-sm leading-relaxed text-slate-400">
              Local perceptual feature vectors by default. Optional OpenAI or
              Replicate hooks when keys are present.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-300/80">
              03 · Match
            </p>
            <p className="text-sm leading-relaxed text-slate-400">
              Cosine nearest-neighbor over the minifig index, then BrickLink
              metadata and price when credentials enrich the catalog.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
