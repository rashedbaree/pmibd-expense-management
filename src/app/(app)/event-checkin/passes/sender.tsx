"use client";

import { useRef, useState } from "react";
import type { SendScope } from "@/lib/checkin/passes";
import { sendPassBatch, sendTestPass } from "./actions";

interface Failure {
  ticket: string;
  name: string;
  email: string;
  error: string;
}

const SCOPE_LABEL: Record<SendScope, string> = {
  team: "Team only (BOD, volunteers…)",
  registered: "Registered attendees only",
  all: "Everyone (team + registered attendees)",
};

const card = "space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800";
const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default function PassSender({
  teamPending,
  registeredPending,
}: {
  teamPending: number;
  registeredPending: number;
}) {
  const [scope, setScope] = useState<SendScope>("team");
  // Remaining people per group; updated after every batch.
  const [left, setLeft] = useState({ team: teamPending, registered: registeredPending });
  const pending =
    scope === "team" ? left.team : scope === "registered" ? left.registered : left.team + left.registered;

  const [note, setNote] = useState("");
  const [chunkSize, setChunkSize] = useState(50);
  const [sent, setSent] = useState(0);
  const [running, setRunning] = useState(false);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const stopRef = useRef(false);

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await sendTestPass(testEmail, note);
      setTestMsg({ ok: r.ok, text: r.message });
    } catch {
      setTestMsg({ ok: false, text: "No response from the server (it may have timed out). Try again." });
    } finally {
      setTesting(false);
    }
  }

  async function run() {
    const runScope = scope;
    const cap = Math.max(1, chunkSize);
    stopRef.current = false;
    setRunning(true);
    setError(null);
    const skip: string[] = [];
    let sentThisClick = 0;
    try {
      while (!stopRef.current && sentThisClick < cap) {
        const r = await sendPassBatch(skip, runScope, note);
        if (r.error) {
          setError(r.error);
          break;
        }
        sentThisClick += r.sent;
        setSent((n) => n + r.sent);
        // `remaining` counts the scope that was just sent; the other group is untouched.
        setLeft((l) =>
          runScope === "team"
            ? { ...l, team: r.remaining }
            : runScope === "registered"
              ? { ...l, registered: r.remaining }
              : { team: 0, registered: r.remaining },
        );
        if (r.failed.length) {
          setFailures((f) => [...f, ...r.failed]);
          // Skip failed addresses for the rest of this run.
          r.failed.forEach((x) => skip.push(x.ticket));
        }
        if (r.sent === 0 && r.failed.length === 0) break;
        if (r.remaining === 0) break;
        // A brief pause between server calls, on top of each batch already
        // being bigger and paced internally - spreads out mail-server logins
        // so a big send doesn't look like abuse to the provider.
        if (!stopRef.current && sentThisClick < cap) await new Promise((res) => setTimeout(res, 1200));
      }
    } catch {
      setError("Lost connection. Click Send again to resume - nobody gets emailed twice.");
    }
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">1. Optional note in the email</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Shown in a highlighted box above the QR code, for example the trial
          run time for the team. Leave empty for none.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder="e.g. Trial run: Thursday 24 Sept, 4:00 PM at the venue. Please bring your phone."
          className={`w-full ${inputClass}`}
        />
      </section>

      <section className={card}>
        <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">2. Send yourself a test</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Check how the email looks on your phone before sending to anyone else.
          The test always uses a made-up attendee, so it never marks a real
          person as sent.
        </p>
        <div className="flex gap-2">
          <input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
            className={`min-w-0 flex-1 ${inputClass}`}
          />
          <button
            onClick={sendTest}
            disabled={testing || !testEmail}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {testing ? "Sending…" : "Send test"}
          </button>
        </div>
        {testMsg && (
          <p className={`text-sm ${testMsg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
            {testMsg.text}
          </p>
        )}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">3. Send</h2>
        <label className="block text-sm">
          Who gets it
          <select
            value={scope}
            disabled={running}
            onChange={(e) => setScope(e.target.value as SendScope)}
            className={`mt-1 w-full ${inputClass}`}
          >
            {(Object.keys(SCOPE_LABEL) as SendScope[]).map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sends in batches with a short pause between each, to avoid tripping
          the mail server&apos;s spam protection. Anyone who already received
          their pass is skipped, so it is safe to stop and resume.
        </p>
        <label className="block text-sm">
          Send up to
          <input
            type="number"
            min={1}
            value={chunkSize}
            disabled={running}
            onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value) || 1))}
            className={`mx-2 w-20 ${inputClass} py-1`}
          />
          at a time, then stop so you can check things are going well.
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {!running ? (
            <button
              onClick={run}
              disabled={pending === 0}
              className="rounded-md bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand/90 disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              Send next {Math.min(chunkSize, pending)} pass{Math.min(chunkSize, pending) === 1 ? "" : "es"}
            </button>
          ) : (
            <button
              onClick={() => (stopRef.current = true)}
              className="rounded-md bg-amber-600 px-5 py-2.5 font-semibold text-white hover:bg-amber-700"
            >
              Stop after this batch
            </button>
          )}
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Sent this session: <b>{sent}</b> · Waiting: <b>{pending}</b>
          </span>
        </div>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
        {failures.length > 0 && (
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-semibold">Could not send to {failures.length}:</p>
            <ul className="list-disc pl-5">
              {failures.map((f, i) => (
                <li key={i}>
                  {f.name} ({f.email}): {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
