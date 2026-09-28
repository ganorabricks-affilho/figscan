"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { MatchResponse, MatchResult } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

type CatalogItem = {
  id: string;
  name: string;
  theme: string;
  year: number;
  imageUrl: string;
  bricklinkUrl: string;
  priceUsd: number | null;
};

type Status = "idle" | "camera" | "preview" | "matching" | "results" | "error";

export function ScanStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [meta, setMeta] = useState<Pick<
    MatchResponse,
    "embeddingProvider" | "catalogSource" | "elapsedMs"
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data: { items: CatalogItem[] }) => setCatalog(data.items ?? []))
      .catch(() => setCatalog([]));

    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const startCamera = async () => {
    setError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setStatus("camera");
      setPreviewUrl(null);
      setMatches([]);
      setMeta(null);
    } catch {
      setError(
        "Camera access was blocked. Allow the camera, or upload a photo instead.",
      );
      setStatus("error");
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    setPreviewUrl(dataUrl);
    setStatus("preview");
    void runMatch(dataUrl);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPG, PNG, WebP, or similar image.");
      setStatus("error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That image is over 8 MB. Try a smaller photo.");
      setStatus("error");
      return;
    }
    stopCamera();
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPreviewUrl(dataUrl);
      setStatus("preview");
      void runMatch(dataUrl);
    };
    reader.onerror = () => {
      setError("Could not read that file. Try another image.");
      setStatus("error");
    };
    reader.readAsDataURL(file);
  };

  const runMatch = useCallback(async (imageDataUrl: string) => {
    setStatus("matching");
    setError(null);
    setMatches([]);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Match failed");
      }
      const payload = data as MatchResponse;
      setMatches(payload.matches);
      setMeta({
        embeddingProvider: payload.embeddingProvider,
        catalogSource: payload.catalogSource,
        elapsedMs: payload.elapsedMs,
      });
      setStatus("results");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while matching. Try again.",
      );
      setStatus("error");
    }
  }, []);

  const reset = () => {
    stopCamera();
    setPreviewUrl(null);
    setMatches([]);
    setMeta(null);
    setError(null);
    setStatus("idle");
  };

  const trySample = async (item: CatalogItem) => {
    stopCamera();
    setError(null);
    try {
      const res = await fetch(item.imageUrl);
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      setPreviewUrl(dataUrl);
      setStatus("preview");
      await runMatch(dataUrl);
    } catch {
      setError("Could not load that sample figure. Try uploading instead.");
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <section className="scan-stage relative overflow-hidden rounded-[1.75rem] border border-white/10">
        <div className="scan-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 p-5 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-300/80">
                Live identify
              </p>
              <h2 className="mt-2 font-display text-2xl tracking-tight text-white sm:text-3xl">
                Point, capture, match
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
                Use your camera or upload a photo. ScanFig embeds the image and
                searches a local minifig index for the closest BrickLink IDs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={startCamera}
                className="bg-teal-400 text-slate-950 hover:bg-teal-300"
              >
                <Camera className="size-4" />
                Open camera
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => fileRef.current?.click()}
              >
                <ImageUp className="size-4" />
                Upload photo
              </Button>
              {(status !== "idle" || previewUrl) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:bg-white/10 hover:text-white"
                  onClick={reset}
                >
                  <RefreshCw className="size-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
              {status === "camera" ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-6 rounded-xl border border-teal-300/40" />
                  <div className="scan-line absolute inset-x-8 top-8 h-px bg-teal-300/80" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-slate-950/90 to-transparent p-4">
                    <Button
                      type="button"
                      size="lg"
                      onClick={captureFrame}
                      disabled={!cameraReady}
                      className="bg-teal-400 text-slate-950 hover:bg-teal-300"
                    >
                      <Sparkles className="size-4" />
                      Capture & match
                    </Button>
                  </div>
                </>
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Selected minifig photo"
                  className="h-full w-full object-contain bg-[radial-gradient(circle_at_center,#1a2740,transparent_70%)]"
                />
              ) : (
                <EmptyStage onUpload={() => fileRef.current?.click()} onCamera={startCamera} />
              )}

              {status === "matching" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 backdrop-blur-sm">
                  <Loader2 className="size-8 animate-spin text-teal-300" />
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-200">
                    Embedding & searching
                  </p>
                </div>
              )}
            </div>

            <div className="flex min-h-[280px] flex-col rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5">
              {status === "error" && error ? (
                <ErrorPanel message={error} onRetry={reset} />
              ) : status === "results" && matches.length > 0 ? (
                <ResultsPanel matches={matches} meta={meta} />
              ) : status === "matching" ? (
                <LoadingPanel />
              ) : (
                <IdlePanel />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-xl text-white">Try a sample figure</h3>
            <p className="mt-1 text-sm text-slate-400">
              Tap any catalog stub to run a match against the local index — no
              BrickLink credentials needed.
            </p>
          </div>
          <Badge className="border border-teal-400/30 bg-teal-400/10 text-teal-200">
            {catalog.length || 32} figs
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {catalog.slice(0, 12).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void trySample(item)}
              className={cn(
                "group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left transition",
                "hover:border-teal-300/40 hover:bg-teal-400/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.name}
                className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="space-y-0.5 p-2.5">
                <p className="truncate text-xs font-medium text-slate-100">
                  {item.name}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  {item.id}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyStage({
  onUpload,
  onCamera,
}: {
  onUpload: () => void;
  onCamera: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-teal-300/30 bg-teal-400/10 text-teal-200">
        <Camera className="size-6" />
      </div>
      <div className="space-y-2">
        <p className="font-display text-lg text-white">No scan yet</p>
        <p className="max-w-sm text-sm text-slate-400">
          Open the camera for a live capture, upload a photo from your library,
          or pick a sample figure below.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onCamera}
          className="bg-teal-400 text-slate-950 hover:bg-teal-300"
        >
          Open camera
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/20 bg-transparent text-white hover:bg-white/10"
          onClick={onUpload}
        >
          Upload
        </Button>
      </div>
    </div>
  );
}

function IdlePanel() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3 text-slate-400">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-300/70">
        Matches
      </p>
      <p className="font-display text-xl text-white">Waiting for a scan</p>
      <p className="text-sm leading-relaxed">
        Top neighbors will show BrickLink ID, name, confidence, catalog link,
        and cached price when available.
      </p>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-300">
        Working
      </p>
      <p className="font-display text-xl text-white">Comparing embeddings…</p>
      <Progress value={66} className="w-full" />
      <p className="text-sm text-slate-400">
        Local feature hash by default. Optional OpenAI or Replicate hooks kick
        in when their env vars are set.
      </p>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-rose-300">
            Scan failed
          </p>
          <p className="mt-2 font-display text-xl text-white">Couldn’t finish</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss error"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="text-sm leading-relaxed text-slate-300">{message}</p>
      <Button
        type="button"
        onClick={onRetry}
        variant="outline"
        className="w-fit border-white/20 bg-transparent text-white hover:bg-white/10"
      >
        Try again
      </Button>
    </div>
  );
}

function ResultsPanel({
  matches,
  meta,
}: {
  matches: MatchResult[];
  meta: Pick<
    MatchResponse,
    "embeddingProvider" | "catalogSource" | "elapsedMs"
  > | null;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-300">
            Top matches
          </p>
          <p className="mt-1 font-display text-xl text-white">Nearest neighbors</p>
        </div>
        {meta && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {meta.embeddingProvider} · {meta.catalogSource} · {meta.elapsedMs}ms
          </p>
        )}
      </div>
      <ul className="space-y-3 overflow-y-auto pr-1">
        {matches.map((match, index) => (
          <li
            key={match.id}
            className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={match.imageUrl}
              alt={match.name}
              className="size-16 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {index === 0 ? "Best: " : ""}
                    {match.name}
                  </p>
                  <p className="font-mono text-[11px] text-teal-300/90">
                    {match.id} · {match.theme} · {match.year}
                  </p>
                </div>
                <Badge className="shrink-0 border border-teal-400/20 bg-teal-400/10 text-teal-100">
                  {Math.round(match.confidence * 100)}%
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                {match.priceUsd != null && (
                  <span>~${match.priceUsd.toFixed(2)} USD</span>
                )}
                <a
                  href={match.bricklinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-300/90 underline-offset-2 hover:underline"
                >
                  BrickLink catalog
                </a>
              </div>
              <Progress value={match.confidence * 100} className="w-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
