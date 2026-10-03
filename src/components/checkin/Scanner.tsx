"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import type { ScanResult } from "@/lib/checkin/checkin";
import { formatTime, type PublicAttendee } from "@/lib/checkin/attendees";
import AttendeeCard from "@/components/checkin/AttendeeCard";

type Mode = "checkin" | "bag";
type Outcome = ScanResult | { result: "error"; message: string };

const API = "/event-checkin/api";
const SAME_CODE_COOLDOWN_MS = 6000;
// A short typed code (e.g. the last few digits of a ticket) below this length
// is looked up and shown for a confirm tap, instead of tried as an exact code.
const SHORT_CODE_MAX_LENGTH = 6;

// A session that expired mid-event doesn't get a JSON error: the app's login
// redirect answers instead. Say so, rather than blaming the connection.
const SIGNED_OUT = "Signed out - reload the page and sign in again.";

async function postJson(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const isJson = r.headers.get("content-type")?.includes("application/json");
  if (r.redirected || !isJson) return { ok: false, signedOut: true as const, json: null };
  return { ok: r.ok, signedOut: false as const, json: await r.json() };
}

export default function Scanner({ mode }: { mode: Mode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef({ code: "", at: 0 });

  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [manual, setManual] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  // Set when a short typed code matched one or more people, awaiting an
  // explicit confirm tap before anything is actually recorded.
  const [candidates, setCandidates] = useState<PublicAttendee[] | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const confirmingRef = useRef(false);
  // Two-tap guard so a stray tap can't undo a real check-in by accident.
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const verb = mode === "bag" ? "Gift bag" : "Check-in";

  const beep = useCallback((ok: boolean) => {
    try {
      const ctx = audioRef.current;
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = ok ? 880 : 220;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (ok ? 0.12 : 0.4));
      }
      navigator.vibrate?.(ok ? 60 : [120, 60, 120]);
    } catch {
      // Sound/vibration are a nicety; never let them break scanning.
    }
  }, []);

  const dismiss = useCallback(() => {
    setOutcome(null);
    setConfirmingUndo(false);
    busyRef.current = false;
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  const submit = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      busyRef.current = true;

      let res: Outcome;
      try {
        const r = await postJson(`${API}/scan`, { code, mode });
        res = r.signedOut
          ? { result: "error", message: SIGNED_OUT }
          : r.ok
            ? (r.json as ScanResult)
            : { result: "error", message: r.json?.error ?? "Server error" };
      } catch {
        res = { result: "error", message: "No connection. Try again." };
      }

      beep(res.result === "ok");
      if (res.result === "ok") setDoneCount((n) => n + 1);
      // Stays on screen until the volunteer taps "Scan next" - no auto-dismiss,
      // so there's always time to read the name and check it against the person.
      setConfirmingUndo(false);
      setOutcome(res);
    },
    [mode, beep],
  );

  async function doUndo(ticket: string) {
    setUndoing(true);
    try {
      await postJson(`${API}/undo`, { code: ticket, mode });
    } catch {
      // Best-effort: if this fails, nothing was changed - the record still
      // stands and can be undone again (e.g. from Search) once back online.
    }
    setUndoing(false);
    dismiss();
  }

  const handleCode = useCallback(
    (code: string) => {
      const now = Date.now();
      const last = lastRef.current;
      if (code === last.code && now - last.at < SAME_CODE_COOLDOWN_MS) return;
      lastRef.current = { code, at: now };
      submit(code);
    },
    [submit],
  );

  // Camera decode loop: ~12-13 frames/sec, downscaled to keep phones cool.
  useEffect(() => {
    if (!cameraOn) return;
    let raf = 0;
    let stopped = false;
    let lastTick = 0;

    const tick = (t: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (t - lastTick < 80) return;
      lastTick = t;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || busyRef.current || confirmingRef.current) return;

      const scale = Math.min(1, 720 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // "attemptBoth" costs a little more per frame but catches codes under
      // glare/reflection or unusual screen colour inversion, which "dontInvert"
      // alone was missing on some phones during the trial run.
      const found = jsQR(img.data, img.width, img.height, {
        inversionAttempts: "attemptBoth",
      });
      if (found?.data) handleCode(found.data);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [cameraOn, handleCode]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("The camera needs a secure (https) connection.");
      }
      audioRef.current ??= new AudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // Keeps refocusing as the QR code moves closer/further, instead of
          // locking focus once at start-up - a common cause of slow scans.
          // "advanced" entries the browser doesn't support are just ignored.
          advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraOn(true);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera permission was blocked. Allow the camera for this site in your browser settings."
          : e instanceof Error
            ? e.message
            : "Could not start the camera.",
      );
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.trim();
    setManual("");
    if (!code) return;
    lastRef.current = { code: "", at: 0 };

    // A short code (e.g. the last 4 digits) is looked up and shown for a
    // confirm tap, rather than tried directly - a full ticket number (or a
    // USB/Bluetooth scanner's exact code) always goes straight through.
    if (code.length >= 2 && code.length <= SHORT_CODE_MAX_LENGTH) {
      setLookingUp(true);
      try {
        const r = await fetch(`${API}/search?q=${encodeURIComponent(code)}`);
        const isJson = r.headers.get("content-type")?.includes("application/json");
        const json = r.redirected || !isJson ? null : await r.json();
        const matches = ((json?.results ?? []) as PublicAttendee[]).filter((a) =>
          a.ticket_number.toUpperCase().endsWith(code.toUpperCase()),
        );
        setLookingUp(false);
        if (matches.length > 0) {
          confirmingRef.current = true;
          setCandidates(matches);
          return;
        }
      } catch {
        setLookingUp(false);
        // No connection to look it up - fall through and try it as-is below.
      }
    }
    submit(code);
  }

  function cancelConfirm() {
    confirmingRef.current = false;
    setCandidates(null);
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }

  function confirmCandidate(ticket: string) {
    confirmingRef.current = false;
    setCandidates(null);
    lastRef.current = { code: "", at: 0 };
    submit(ticket);
  }

  const overlay = outcome && overlayStyle(outcome);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          Station: <b>{verb}</b>
        </span>
        <span>Done on this device: {doneCount}</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`aspect-[4/3] w-full object-cover ${cameraOn ? "" : "hidden"}`}
        />
        <canvas ref={canvasRef} className="hidden" />
        {cameraOn ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1/2 w-1/2 rounded-2xl border-4 border-white/70" />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <p className="text-sm text-white/70">
              Tap to start the camera, then hold the QR code inside the frame.
            </p>
            <button
              onClick={startCamera}
              className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-zinc-900"
            >
              Start camera
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
      {cameraOn && (
        <button
          onClick={stopCamera}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Stop camera
        </button>
      )}

      <form onSubmit={submitManual} className="space-y-1">
        <label className="text-sm font-medium" htmlFor="manual">
          USB / Bluetooth scanner, full ticket number, or just the last few digits
        </label>
        <div className="flex gap-2">
          <input
            id="manual"
            ref={inputRef}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="BPMS26TICKET0001 or 0001"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-3 font-mono text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            disabled={lookingUp}
            className="rounded-md bg-brand px-4 font-medium text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {lookingUp ? "…" : "Go"}
          </button>
        </div>
      </form>

      {candidates && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-brand p-6 text-white">
          <div className="text-2xl font-black tracking-wide">CONFIRM</div>
          <p className="text-sm text-white/80">
            {candidates.length > 1
              ? "More than one match - pick the right person:"
              : "Is this the right person?"}
          </p>
          <div className="w-full max-w-sm space-y-4">
            {candidates.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white/10 p-4">
                <AttendeeCard a={a} />
                <button
                  onClick={() => confirmCandidate(a.ticket_number)}
                  className="mt-4 w-full rounded-lg bg-white px-4 py-3 text-base font-bold text-zinc-900"
                >
                  Confirm & {mode === "bag" ? "give bag" : "check in"}
                </button>
              </div>
            ))}
          </div>
          <button onClick={cancelConfirm} className="text-sm underline underline-offset-4 opacity-80">
            None of these - cancel
          </button>
        </div>
      )}

      {outcome && overlay && (
        <div
          onClick={confirmingUndo ? undefined : dismiss}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6 text-white ${overlay.bg}`}
        >
          <div className="text-5xl font-black tracking-wide">{overlay.title}</div>
          {outcome.result === "ok" && (
            <>
              <AttendeeCard a={outcome.attendee} />
              {outcome.note && (
                <p className="max-w-md rounded-xl bg-amber-300 px-4 py-3 text-base font-semibold text-zinc-900">
                  {outcome.note}
                </p>
              )}
            </>
          )}
          {outcome.result === "already" && (
            <>
              <AttendeeCard a={outcome.attendee} />
              <p className="text-xl font-semibold">
                {mode === "bag" ? "Bag already given" : "Already checked in"} at{" "}
                {formatTime(outcome.at)}
                {outcome.by ? ` by ${outcome.by}` : ""}
              </p>
            </>
          )}
          {outcome.result === "notfound" && (
            <p className="max-w-md break-all text-center text-lg">
              No paid ticket matches <span className="font-mono">{outcome.code}</span>.
              Try Search by name, or send them to the help desk.
            </p>
          )}
          {outcome.result === "error" && (
            <p className="max-w-md text-center text-lg">{outcome.message}</p>
          )}

          {confirmingUndo && (outcome.result === "ok" || outcome.result === "already") ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center gap-2 rounded-2xl bg-black/20 p-4"
            >
              <p className="text-sm">Undo this - wrong person?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingUndo(false)}
                  className="rounded-full border border-white/60 px-5 py-2 text-sm font-semibold"
                >
                  No, keep it
                </button>
                <button
                  onClick={() => doUndo(outcome.attendee.ticket_number)}
                  disabled={undoing}
                  className="rounded-full bg-white px-5 py-2 text-sm font-bold text-red-700 disabled:opacity-60"
                >
                  {undoing ? "Undoing…" : "Yes, undo"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={dismiss}
              className="rounded-full bg-white px-6 py-3 text-base font-bold text-zinc-900"
            >
              Scan next ›
            </button>
          )}

          {!confirmingUndo && (outcome.result === "ok" || outcome.result === "already") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingUndo(true);
              }}
              className="text-sm underline underline-offset-4 opacity-80"
            >
              Wrong person? Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function overlayStyle(o: Outcome) {
  switch (o.result) {
    case "ok":
      return { bg: "bg-emerald-600", title: "✓ WELCOME" };
    case "already":
      return { bg: "bg-amber-600", title: "ALREADY DONE" };
    case "notfound":
      return { bg: "bg-red-600", title: "NOT FOUND" };
    default:
      return { bg: "bg-zinc-700", title: "ERROR" };
  }
}
