"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { formatTime, startOfTodayManila } from "@/lib/today";
import { getArrivalTiming } from "@/lib/queuePolicy";
import ClinicControls from "./ClinicControls";

type Status = "waiting" | "called" | "served" | "skipped" | "no_show" | "cancelled";

export type Entry = {
  id: string;
  queue_number: number;
  name: string;
  phone: string | null;
  visit_reason: string | null;
  status: Status;
  created_at: string;
  queued_at: string;
  called_at: string | null;
  returning_visit: boolean;
  prev_visit_at: string | null;
  is_minor: boolean;
  guardian_name: string | null;
  appointment_id: string | null;
  appointment_starts_at?: string | null;
};

type SyncState = "connecting" | "live" | "fallback" | "offline";

const REASONS = ["Checkup", "Toothache", "Cleaning", "Braces", "Other"];


const PH_MOBILE_PATTERN = /^(?:09\d{9}|\+639\d{9})$/;

function normalizeMobileInput(value: string): string {
  // Remove spaces, hyphens, and other formatting characters.
  const cleaned = value.replace(/[^\d+]/g, "");

  // Keep only a single leading plus sign.
  const normalized = cleaned.startsWith("+")
    ? "+" + cleaned.slice(1).replace(/\+/g, "")
    : cleaned.replace(/\+/g, "");

  // Local: 11 digits.
  // International: +63 plus 10 digits (13 characters total).
  const maxLength = normalized.startsWith("+") ? 13 : 11;

  return normalized.slice(0, maxLength);
}


// Patients type their own names, so anything written into a printed page must be escaped.
function escapeHtml(s: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

export default function QueueBoard({
  clinicId,
  clinicName,
  acceptingJoins,
  initialGraceMinutes,
  initial,
}: {
  clinicId: string;
  clinicName: string;
  acceptingJoins: boolean;
  initialGraceMinutes: number;
  initial: Entry[];
}) {
  const supabase = createClient();
  const [entries, setEntries] = useState<Entry[]>(initial);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("09");
  const [reason, setReason] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardian, setGuardian] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");
  const [graceMinutes, setGraceMinutes] = useState(initialGraceMinutes);
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pendingId, setPendingId] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const kickoff = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(kickoff);
  }, []);

  const refresh = useCallback(async () => {
    const { data, error: refreshError } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("clinic_id", clinicId)
      .gte("created_at", startOfTodayManila())
      .order("queued_at");
    if (refreshError) {
      setSyncState(navigator.onLine ? "fallback" : "offline");
      return;
    }

    const rows = (data ?? []) as Entry[];
    const appointmentIds = [...new Set(rows.flatMap((row) => row.appointment_id ? [row.appointment_id] : []))];
    const appointmentTimes = new Map<string, string>();

    if (appointmentIds.length > 0) {
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, starts_at")
        .in("id", appointmentIds);
      for (const appointment of appointments ?? []) {
        appointmentTimes.set(appointment.id as string, appointment.starts_at as string);
      }
    }

    const { data: clinic } = await supabase
      .from("clinics")
      .select("grace_minutes")
      .eq("id", clinicId)
      .maybeSingle();

    setEntries(rows.map((row) => ({
      ...row,
      appointment_starts_at: row.appointment_id ? appointmentTimes.get(row.appointment_id) ?? null : null,
    })));
    if (clinic?.grace_minutes !== undefined) setGraceMinutes(clinic.grace_minutes as number);
    setLastSyncedAt(new Date());
  }, [supabase, clinicId]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void refresh(), 0);
    const channel = supabase
      .channel(`queue-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries", filter: `clinic_id=eq.${clinicId}` },
        () => refresh()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSyncState("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setSyncState(navigator.onLine ? "fallback" : "offline");
        }
      });

    const timer = window.setInterval(refresh, 5000);
    const onOnline = () => { setSyncState("connecting"); refresh(); };
    const onOffline = () => setSyncState("offline");
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [supabase, clinicId, refresh]);

  async function setStatus(id: string, status: Status) {
    if (!navigator.onLine) {
      setSyncState("offline");
      setError("No internet connection. Nothing changed. Reconnect, then try again.");
      return;
    }
    setError("");
    setNotice("");
    setPendingId(id);
    const now = new Date().toISOString();
    const patch: Record<string, string> = { status };

    if (status === "called") {
      patch.called_at = now;
    }

    if (status === "waiting") {
      patch.queued_at = now;
    }

    if (status === "served") {
      patch.finished_at = now;
      patch.served_at = now;
    }
    const { error } = await supabase.from("queue_entries").update(patch).eq("id", id);
    setPendingId("");
    if (error) {
      setError(`The queue did not update: ${error.message}. Please try again.`);
      setSyncState(navigator.onLine ? "fallback" : "offline");
      return;
    }
    await refresh();
  }

  async function reinsert(id: string, placement: "next" | "end") {
    if (!navigator.onLine) {
      setSyncState("offline");
      setError("No internet connection. Nothing changed. Reconnect, then try again.");
      return;
    }
    setError("");
    setNotice("");
    setPendingId(id);
    const firstWaiting = entries.find((entry) => entry.status === "waiting");
    const queuedAt = placement === "next" && firstWaiting
      ? new Date(new Date(firstWaiting.queued_at).getTime() - 1).toISOString()
      : new Date().toISOString();
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "waiting", queued_at: queuedAt })
      .eq("id", id);
    setPendingId("");
    if (error) {
      setError(`The patient was not put back in line: ${error.message}. Please try again.`);
      return;
    }
    setNotice(placement === "next" ? "Patient is next in line." : "Patient was placed at the back of the line.");
    await refresh();
  }

  async function addWalkIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!navigator.onLine) {
      setSyncState("offline");
      setError("No internet connection. Nothing changed. Reconnect, then try again.");
      return;
    }
    if (!name.trim()) {
      return setError("Enter the patient's name.");
    }

    if (phone !== "" && phone !== "09" && !PH_MOBILE_PATTERN.test(phone)) {
      return setError(
        "Enter a valid Philippine mobile number: 09171234567 or +639171234567."
      );
    }

    if (isMinor && !guardian.trim()) {
      return setError("Enter the parent or guardian's name.");
    }

    setAdding(true);
    const { data, error } = await supabase
      .from("queue_entries")
      .insert({
        clinic_id: clinicId,
        name: name.trim(),
        phone: phone === "09" ? null : phone.trim() || null,
        visit_reason: reason || null,
        is_minor: isMinor,
        guardian_name: isMinor ? guardian.trim() : null,
      })
      .select("queue_number")
      .single();
    setAdding(false);
    if (error) return setError(error.message);
    setNotice(`${name.trim()} is #${data.queue_number}. Tell the patient their number.`);
    setName(""); setPhone("09"); setReason(""); setIsMinor(false); setGuardian("");
    refresh();
  }

  function printPoster() {
    const svg = document.getElementById("qr-wrap")?.innerHTML ?? "";
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return setError("Allow pop-ups to print the poster.");
    w.document.write(
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h1>${escapeHtml(clinicName)}</h1>
        <h2>Scan to join the queue or book a visit</h2>
        <div style="width:360px;margin:24px auto">${svg}</div>
        <p>Get a number and wait wherever you like.</p>
      </body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function patientNote(e: Entry): string {
    const parts: string[] = [];
    if (e.returning_visit) {
      parts.push(e.prev_visit_at ? `Returning, last visit ${new Date(e.prev_visit_at).toLocaleDateString("en-PH")}` : "Returning patient");
    } else if (e.phone) {
      parts.push("New patient");
    }
    if (e.appointment_id) parts.push("Booked appointment");
    if (e.is_minor) parts.push(`Child, guardian: ${e.guardian_name ?? "not given"}`);
    return parts.join(" · ");
  }

  function appointmentTiming(e: Entry) {
    if (!e.appointment_starts_at) return null;
    return getArrivalTiming(e.appointment_starts_at, e.created_at, graceMinutes);
  }

  function appointmentTimingLabel(e: Entry): string {
    if (!e.appointment_starts_at) return "";
    const timing = appointmentTiming(e);
    if (!timing) return "";
    const scheduled = formatTime(e.appointment_starts_at);
    if (timing.window === "early") return `Scheduled ${scheduled} · checked in on time`;
    if (timing.window === "grace") {
      return `Scheduled ${scheduled} · ${timing.minutesAfterStart} min late · within ${graceMinutes}-min grace`;
    }
    return `Scheduled ${scheduled} · ${timing.minutesAfterStart} min late · ${timing.minutesPastGrace} min past grace`;
  }

  const called = entries.filter((e) => e.status === "called");
  const waiting = entries.filter((e) => e.status === "waiting");
  const skipped = entries.filter((e) => e.status === "skipped");
  const served = entries.filter((e) => e.status === "served").length;
  const noShow = entries.filter((e) => e.status === "no_show").length;
  const left = entries.filter((e) => e.status === "cancelled").length;
  const next = waiting[0];

  const waits = entries.flatMap((e) =>
    e.called_at ? [(new Date(e.called_at).getTime() - new Date(e.created_at).getTime()) / 60000] : []
  );
  const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null;

  const joinUrl = `${origin}/c/${clinicId}`;
  const displayUrl = `${origin}/display/${clinicId}`;

  return (
    <div className="mt-6 flex flex-col gap-5 text-[#2E1747] sm:mt-8 sm:gap-6">


    {/* Live Queue and Online Queue Joining */}

    <header className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">

      {/* Live Queue Header */}

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-6">

        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#2E1747] sm:text-3xl">
            Live queue
          </h1>

          <p className="mt-1 text-sm text-[#756581]">
            Call patients, manage late arrivals, and keep the front desk moving.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            next && setStatus(next.id, "called")
          }
          disabled={
            !next ||
            !!pendingId ||
            syncState === "offline"
          }
          className="min-h-12 w-full shrink-0 rounded-xl bg-[#6D3AA8] px-6 py-3 font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {pendingId === next?.id
            ? "Calling…"
            : next
              ? `Call next · #${next.queue_number}`
              : "Queue is empty"}
        </button>

      </div>

      {/* Online Queue Joining - Integrated */}

      <ClinicControls
        clinicId={clinicId}
        acceptingJoins={acceptingJoins}
      />

    </header>



      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice}</p>}

      <div className="grid gap-5 xl:grid-cols-12 xl:items-start">
        <section aria-labelledby="serving-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8151AE]">At the counter</p>
              <h2 id="serving-heading" className="mt-1 text-lg font-bold">Now serving</h2>
            </div>
            <span className="rounded-full bg-[#F2EAFF] px-3 py-1 text-xs font-semibold text-[#6D3AA8]">{called.length} active</span>
          </div>
          {called.length === 0 && <p className="rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#756581]">No patient has been called yet.</p>}
          <ul className="flex flex-col gap-3">
            {called.map((e) => (
              <li key={e.id} className="rounded-2xl border border-[#CDB8E5] bg-gradient-to-br from-[#F7F1FF] to-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-4xl font-extrabold tracking-tight text-[#6D3AA8]">#{e.queue_number}</p>
                    <p className="mt-1 break-words font-bold">{e.name}</p>
                    <p className="mt-1 text-sm text-[#756581]">{e.visit_reason ?? "No reason given"}</p>
                    {patientNote(e) && <p className="mt-1 text-xs font-medium text-[#6D3AA8]">{patientNote(e)}</p>}
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#6D3AA8] shadow-sm">Called</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!!pendingId || syncState === "offline"}
                    onClick={() => setStatus(e.id, "served")}
                    className="min-h-11 rounded-xl bg-[#6D3AA8] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#572C87] disabled:opacity-45"
                  >
                    Mark served
                  </button>
                  <button
                    type="button"
                    disabled={!!pendingId || syncState === "offline"}
                    onClick={() => setStatus(e.id, "no_show")}
                    className="min-h-11 rounded-xl border border-[#D7C4EA] bg-white px-3 py-2 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF] disabled:opacity-45"
                  >
                    No-show
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="waiting-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5 xl:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8151AE]">Next patients</p>
              <h2 id="waiting-heading" className="mt-1 text-lg font-bold">Waiting queue</h2>
            </div>
            <span className="rounded-full bg-[#F2EAFF] px-3 py-1 text-xs font-semibold text-[#6D3AA8]">{waiting.length} waiting</span>
          </div>
          {waiting.length === 0 && <p className="rounded-xl bg-[#FAF8FF] p-4 text-sm text-[#756581]">The queue is empty.</p>}
          <ul className="flex flex-col gap-3">
            {waiting.map((e, index) => (
              <li key={e.id} className="rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-bold"><span className="mr-2 text-lg text-[#6D3AA8]">#{e.queue_number}</span>{e.name}</p>
                    <p className="mt-1 text-xs text-[#756581]">{e.visit_reason ?? "No reason"}{e.phone ? "" : " · no phone"}</p>
                    {patientNote(e) && <p className="mt-1 text-xs font-medium text-[#6D3AA8]">{patientNote(e)}</p>}
                    {e.appointment_starts_at && (
                      <p className={`mt-2 text-xs font-semibold ${appointmentTiming(e)?.window === "late" ? "text-red-700" : "text-amber-700"}`}>
                        {appointmentTimingLabel(e)}
                      </p>
                    )}
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <button
                      type="button"
                      disabled={!!pendingId || syncState === "offline"}
                      onClick={() => setStatus(e.id, "called")}
                      className="min-h-11 rounded-xl bg-[#6D3AA8] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#572C87] disabled:opacity-45"
                    >
                      Call
                    </button>
                    {appointmentTiming(e)?.window === "late" && index < waiting.length - 1 && (
                      <button
                        type="button"
                        disabled={!!pendingId || syncState === "offline"}
                        onClick={() => reinsert(e.id, "end")}
                        className="min-h-11 rounded-xl border border-[#D7C4EA] bg-white px-3 py-2 text-xs font-semibold text-[#5C327F] disabled:opacity-45"
                      >
                        Move to back
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!!pendingId || syncState === "offline"}
                      onClick={() => setStatus(e.id, "skipped")}
                      className="min-h-11 rounded-xl border border-[#D7C4EA] bg-white px-3 py-2 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF] disabled:opacity-45"
                    >
                      {e.appointment_id ? "Hold" : "Skip"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {skipped.length > 0 && (
            <div className="mt-5 border-t border-[#E4D5F6] pt-5">
              <h3 className="mb-3 text-sm font-bold text-[#5C327F]">On hold or skipped</h3>
              <ul className="flex flex-col gap-2">
                {skipped.map((e) => (
                  <li key={e.id} className="flex flex-col gap-3 rounded-xl bg-[#F7F1FF] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 break-words font-semibold">
                      <span className="text-[#6D3AA8]">#{e.queue_number}</span> {e.name}
                      {e.appointment_starts_at && <span className="mt-1 block text-xs font-normal text-[#756581]">{appointmentTimingLabel(e)}</span>}
                    </span>
                    <span className="grid shrink-0 grid-cols-2 gap-2">
                      {e.appointment_id && (
                        <button type="button" disabled={!!pendingId || syncState === "offline"} onClick={() => reinsert(e.id, "next")} className="min-h-11 rounded-xl border border-[#D7C4EA] bg-white px-3 py-2 text-xs font-semibold text-[#5C327F] disabled:opacity-45">Put next</button>
                      )}
                      <button type="button" disabled={!!pendingId || syncState === "offline"} onClick={() => reinsert(e.id, "end")} className="min-h-11 rounded-xl border border-[#D7C4EA] bg-white px-3 py-2 text-xs font-semibold text-[#5C327F] disabled:opacity-45">Back to end</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="walkin-heading" className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-5 xl:col-span-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8151AE]">Front desk entry</p>
          <h2 id="walkin-heading" className="mt-1 text-lg font-bold">Add a walk-in</h2>
          <p className="mt-1 text-sm text-[#756581]">Create a queue ticket for a patient at the counter.</p>
          <form onSubmit={addWalkIn} className="mt-5 flex flex-col gap-4">
            <div>
              <label htmlFor="walkin-name" className="mb-1.5 block text-sm font-semibold">Patient name</label>
              <input id="walkin-name" className="min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label
                htmlFor="walkin-phone"
                className="mb-1.5 block text-sm font-semibold"
              >
                Mobile number{" "}
                <span className="font-normal text-[#756581]">
                  (optional)
                </span>
              </label>

              <input
                id="walkin-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={13}
                className="min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]"
                placeholder="09171234567"
                value={phone}
                onChange={(e) =>
                  setPhone(normalizeMobileInput(e.target.value))
                }
              />

              <p className="mt-1.5 text-xs text-[#756581]">
                Enter 11 digits starting with 09, or +63 followed by
                10 digits starting with 9.
              </p>
            </div>

            <div>
              <label htmlFor="walkin-reason" className="mb-1.5 block text-sm font-semibold">Reason for visit <span className="font-normal text-[#756581]">(optional)</span></label>
              <select id="walkin-reason" className="min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-[#FAF8FF] px-3 py-2 text-sm font-medium">
              <input className="size-5 accent-[#6D3AA8]" type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
              Patient is under 18
            </label>
            {isMinor && (
              <div>
                <label htmlFor="walkin-guardian" className="mb-1.5 block text-sm font-semibold">Parent or guardian</label>
                <input id="walkin-guardian" className="min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-3 py-2 outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]" placeholder="Full name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
              </div>
            )}
            <button disabled={adding || syncState === "offline"} aria-busy={adding} className="min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 font-bold text-white transition hover:bg-[#572C87] disabled:cursor-not-allowed disabled:opacity-45">
              {adding ? "Adding patient…" : "Add to queue"}
            </button>
          </form>
          <p className="mt-3 text-xs leading-5 text-[#756581]">No phone? Leave it blank and tell the patient their number out loud.</p>
        </section>
      </div>

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Waiting", waiting.length],
          ["Served", served],
          ["No-show", noShow],
          ["Left queue", left],
          ["Average wait", avgWait === null ? "—" : `${avgWait} min`],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#756581]">{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#2E1747]">{value}</p>
          </div>
        ))}
      </section>

      <details className="group mb-6 rounded-2xl border border-[#E4D5F6] bg-white shadow-sm sm:mb-8">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold text-[#2E1747] sm:px-5">
          <span>Share the patient queue</span>
          <span className="text-xl text-[#6D3AA8] transition group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <div className="grid gap-6 border-t border-[#E4D5F6] p-4 sm:p-5 md:grid-cols-[auto_1fr]">
          <div>
            <div id="qr-wrap" className="w-44 rounded-2xl border border-[#E4D5F6] bg-white p-3 shadow-sm sm:w-48">
              {origin && <QRCodeSVG value={joinUrl} width="100%" height="100%" />}
            </div>
            <button type="button" onClick={printPoster} className="mt-3 min-h-11 w-full rounded-xl bg-[#6D3AA8] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#572C87]">Print QR poster</button>
          </div>
          <div className="min-w-0 space-y-4 text-sm">
            <div className="rounded-xl bg-[#FAF8FF] p-3">
              <p className="font-semibold text-[#2E1747]">Patient link</p>
              <p className="mt-1 break-all text-[#756581]">{joinUrl}</p>
            </div>
            <div className="rounded-xl bg-[#FAF8FF] p-3">
              <p className="font-semibold text-[#2E1747]">TV display link</p>
              <p className="mt-1 break-all text-[#756581]">{displayUrl}</p>
            </div>
            {origin.includes("localhost") && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                Phones cannot open a localhost QR code. It will work after the app is deployed online.
              </p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
