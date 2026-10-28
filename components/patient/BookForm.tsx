"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SlotPicker from "@/components/SlotPicker";
import { todayManila } from "@/lib/today";
import { useVisitReasons } from "@/lib/useVisitReasons";

const FIELD_CLASS = "min-h-12 w-full rounded-xl border border-[#E4D5F6] bg-white px-4 py-3 text-base text-[#2E1747] outline-none transition placeholder:text-[#9B8FA6] focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#F2EAFF]";

type Info = { name: string; accepting: boolean };

export default function BookForm({
  clinicId,
  onDone,
}: {
  clinicId: string;
  onDone: (appointmentId: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [info, setInfo] = useState<Info | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [slot, setSlot] = useState("");
  const [day, setDay] = useState(todayManila());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountName, setAccountName] = useState("");
  const [reason, setReason] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardian, setGuardian] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waitlisted, setWaitlisted] = useState(false);
  const { names: REASONS, reasons: reasonList } = useVisitReasons(clinicId, "online");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("booking_info", { p_clinic_id: clinicId });
      setInfo(data);
      setLoaded(true);
    })();
  }, [supabase, clinicId]);


  useEffect(() => {
    let cancelled = false;

    async function loadAccountDetails() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const { data, error } = await supabase.rpc("my_account");

      if (cancelled || error || !data) return;

      const account = data as {
        name?: string | null;
        phone?: string | null;
      };


    const savedName = account.name?.trim() ?? "";

    const savedPhone =
      typeof user.user_metadata?.contact_phone === "string"
        ? user.user_metadata.contact_phone.trim()
        : account.phone?.trim() ?? "";

    setAccountName(savedName);
    setPhone((current) => current || savedPhone);

    }

    void loadAccountDetails();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!isMinor && accountName) {
      setName((current) => current || accountName);
    }
  }, [accountName, isMinor]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!slot) return setError("Pick a date and a time.");
    if (!name.trim()) return setError(isMinor ? "Enter the child's name." : "Enter your name.");
    if (isMinor && !guardian.trim()) return setError("Enter the parent or guardian's name.");
    setBusy(true);
    const { data, error } = await supabase.rpc("book_appointment", {
      p_clinic_id: clinicId, p_name: name, p_phone: phone, p_reason: reason, p_starts_at: slot,
      p_is_minor: isMinor, p_guardian: isMinor ? guardian : null, p_by_staff: false,
    });
    setBusy(false);
    if (error) return setError(error.message);
    onDone(data.id);
  }

  async function joinWaitlist() {
    setError("");
    if (!name.trim()) return setError("Fill in your name below first.");
    if (!phone.trim()) return setError("Fill in your phone number below so the clinic can call you.");
    const { error } = await supabase.rpc("join_waitlist", {
      p_clinic_id: clinicId, p_name: name, p_phone: phone, p_reason: reason, p_day: day,
    });
    if (error) return setError(error.message);
    setWaitlisted(true);
  }

  if (!loaded) return <p className="rounded-2xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#6F647A]">Loading appointment times…</p>;
  if (!info) return <p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Clinic not found.</p>;
  if (!info.accepting) {
    return <p className="rounded-2xl border border-[#E4D5F6] bg-white p-5 text-sm text-[#6F647A]">Online booking is not available right now. Please call the clinic.</p>;
  }
  if (waitlisted) {
    return (
      <div className="rounded-2xl border border-[#D8C5EF] bg-[#F2EAFF] p-5 text-[#2E1747] shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B4BB3]">Request received</p>
        <h2 className="mt-2 text-2xl font-bold">You are on the waitlist</h2>
        <p className="mt-2 leading-6 text-[#6F647A]">
          {info.name} will call you if a time opens up. This is not a confirmed booking.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-[#2E1747]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B4BB3]">Schedule a visit</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2E1747] sm:text-3xl">Book an appointment</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#6F647A] sm:text-base">Choose an available time and tell us who the appointment is for.</p>
      </div>

      <form onSubmit={book} className="flex flex-col gap-5 rounded-2xl border border-[#E4D5F6] bg-white p-4 shadow-sm sm:p-6">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-[#49365E]">
            Select a date and time <span className="text-red-500" aria-hidden="true">*</span>
          </legend>
          <SlotPicker
            clinicId={clinicId} value={slot} onChange={setSlot} onDayChange={setDay}
            appearance="patient"
            emptyAction={
              <button type="button" onClick={joinWaitlist} className="min-h-11 self-start rounded-xl border border-[#CDBCE9] bg-white px-4 py-2 text-sm font-semibold text-[#633795] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E5D8F5]">
                Join the waitlist for this day
              </button>
            }
          />
        </fieldset>

        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-[#FAF8FF] px-4 py-3 text-sm font-medium text-[#49365E]">
          <input className="size-5 shrink-0 accent-[#6D3AA8]" type="checkbox" checked={isMinor} 
            onChange={(e) => { const checked = e.target.checked; setIsMinor(checked); setName(checked ? "" : accountName);setGuardian(checked ? accountName : ""); }} />
          <span>This appointment is for a child under 18</span>
        </label>

        <div>
          <label htmlFor="booking-patient-name" className="mb-2 block text-sm font-semibold text-[#49365E]">
            {isMinor ? "Child's full name" : "Full name"}{" "}
            <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input id="booking-patient-name" className={FIELD_CLASS} placeholder={isMinor ? "Enter the child's name" : "Enter your full name"}
            value={name} onChange={(e) => setName(e.target.value)} autoComplete={isMinor ? "off" : "name"} />
        </div>
        {isMinor && (
          <div>
            <label htmlFor="booking-guardian-name" className="mb-2 block text-sm font-semibold text-[#49365E]">
              Parent or guardian&apos;s full name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input id="booking-guardian-name" className={FIELD_CLASS} placeholder="Enter parent or guardian's name"
              value={guardian} onChange={(e) => setGuardian(e.target.value)} />
          </div>
        )}

        <div>
<label htmlFor="booking-mobile" className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-[#49365E]">
  <span>{isMinor ? "Parent's mobile number" : "Mobile number"}</span>
  <span className="text-xs font-normal text-[#82758E]">(optional)</span>
</label>          <input id="booking-mobile" className={FIELD_CLASS} placeholder="e.g. 0917 123 4567"
            inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </div>

        <div>
<label htmlFor="booking-reason" className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-[#49365E]">
  <span>Reason for visit</span>
  <span className="text-xs font-normal text-[#82758E]">(optional)</span>
</label>          <select id="booking-reason" className={FIELD_CLASS} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason</option>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {reasonList.find((r) => r.name === reason)?.note && (
            <p className="mt-2 rounded-xl bg-[#F2EAFF] p-3 text-sm text-[#5A2E8A]">
              {reasonList.find((r) => r.name === reason)?.note}
            </p>
          )}
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <button disabled={busy} aria-busy={busy} className="min-h-12 rounded-xl bg-[#6D3AA8] px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#572C87] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg">
          {busy ? "Booking..." : "Book appointment"}
        </button>
      </form>
      <p className="rounded-xl bg-[#F2EAFF] px-4 py-3 text-xs leading-5 text-[#6F647A]">
        We use your details only to manage your appointment and recognize you on your next visit.
        We do not store medical records here.
      </p>
    </div>
  );
}
