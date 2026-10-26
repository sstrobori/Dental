
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayManila } from "@/lib/today";

type ServedEntry = {
  id: string;
  queue_number: number;
  name: string;
  visit_reason: string | null;
  served_at: string | null;
  finished_at: string | null;
  created_at: string;
};

const PH_TIMEZONE = "Asia/Manila";
const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function monthParts(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  const firstDayOffset = new Date(
    Date.UTC(year, monthNumber - 1, 1)
  ).getUTCDay();

  const numberOfDays = new Date(
    Date.UTC(year, monthNumber, 0)
  ).getUTCDate();

  const followingMonth = new Date(
    Date.UTC(year, monthNumber, 1)
  )
    .toISOString()
    .slice(0, 7);

  return {
    year,
    monthNumber,
    firstDayOffset,
    numberOfDays,
    followingMonth,
    beginning: `${month}-01T00:00:00+08:00`,
    end: `${followingMonth}-01T00:00:00+08:00`,
  };
}

function shiftMonth(month: string, shift: number) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(
    Date.UTC(year, monthNumber - 1 + shift, 1)
  )
    .toISOString()
    .slice(0, 7);
}

function manilaDateKey(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));

  const valueOf = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

function dayLabel(date: string) {
  return new Date(
    `${date}T12:00:00+08:00`
  ).toLocaleDateString("en-PH", {
    timeZone: PH_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function servedTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-PH", {
    timeZone: PH_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ServedCalendarPage() {
  const supabase = useMemo(() => createClient(), []);

  const [clinicId, setClinicId] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [month, setMonth] = useState(
    () => todayManila().slice(0, 7)
  );

  const [records, setRecords] = useState<ServedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedDay, setSelectedDay] = useState<string | null>(
    null
  );

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dateButtonRef = useRef<HTMLButtonElement | null>(null);

  const calendar = useMemo(
    () => monthParts(month),
    [month]
  );

  const today = todayManila();

  const monthTitle = new Date(
    `${month}-01T12:00:00+08:00`
  ).toLocaleDateString("en-PH", {
    timeZone: PH_TIMEZONE,
    month: "long",
    year: "numeric",
  });

  // Get the clinic associated with the logged-in staff.
  useEffect(() => {
    let cancelled = false;

    async function identifyClinic() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        setError(
          "Your session has expired. Please sign in again."
        );
        setCheckingAccess(false);
        setLoading(false);
        return;
      }

      const {
        data: staff,
        error: staffError,
      } = await supabase
        .from("clinic_staff")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (staffError || !staff?.clinic_id) {
        setError(
          staffError?.message ??
            "No clinic is linked to this staff account."
        );
        setCheckingAccess(false);
        setLoading(false);
        return;
      }

      setClinicId(staff.clinic_id);
      setCheckingAccess(false);
    }

    void identifyClinic();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Load served patients for the selected month.
  // Priority:
  // 1. served_at
  // 2. finished_at
  // 3. created_at (historical fallback)
  useEffect(() => {
    if (!clinicId) return;

    let cancelled = false;
    const batchSize = 500;

    async function loadMonth() {
      setLoading(true);
      setError("");
      setRecords([]);

      const all: ServedEntry[] = [];

      for (
        let offset = 0;
        ;
        offset += batchSize
      ) {
        let {
          data,
          error: queryError,
        } = await supabase
          .from("queue_entries")
          .select(
            "id, queue_number, name, visit_reason, created_at, finished_at, served_at"
          )
          .eq("clinic_id", clinicId)
          .eq("status", "served")
          .or(
            `and(served_at.gte.${calendar.beginning},served_at.lt.${calendar.end}),` +
            `and(served_at.is.null,finished_at.gte.${calendar.beginning},finished_at.lt.${calendar.end}),` +
            `and(served_at.is.null,finished_at.is.null,created_at.gte.${calendar.beginning},created_at.lt.${calendar.end})`
          )
          .order("created_at", {
            ascending: true,
          })
          .order("id", {
            ascending: true,
          })
          .range(
            offset,
            offset + batchSize - 1
          );

        // Fallback if served_at column does not exist.
        if (
          queryError &&
          /served_at/i.test(queryError.message)
        ) {
          const fallback = await supabase
            .from("queue_entries")
            .select(
              "id, queue_number, name, visit_reason, created_at, finished_at"
            )
            .eq("clinic_id", clinicId)
            .eq("status", "served")
            .or(
              `and(finished_at.gte.${calendar.beginning},finished_at.lt.${calendar.end}),` +
              `and(finished_at.is.null,created_at.gte.${calendar.beginning},created_at.lt.${calendar.end})`
            )
            .order("created_at", {
              ascending: true,
            })
            .order("id", {
              ascending: true,
            })
            .range(
              offset,
              offset + batchSize - 1
            );

          data = (fallback.data ?? []).map(
            (entry) => ({
              ...entry,
              served_at: null,
            })
          );

          queryError = fallback.error;
        }

        if (cancelled) return;

        if (queryError) {
          setRecords([]);
          setError(
            `Could not load served patients: ${queryError.message}`
          );
          setLoading(false);
          return;
        }

        const page = (data ?? []) as ServedEntry[];

        all.push(...page);

        if (page.length < batchSize) {
          break;
        }
      }

      if (!cancelled) {
        setRecords(all);
        setLoading(false);
      }
    }

    void loadMonth();

    return () => {
      cancelled = true;
    };
  }, [
    supabase,
    clinicId,
    calendar.beginning,
    calendar.end,
    refreshKey,
  ]);

  // Realtime changes and periodic backup refresh.
  useEffect(() => {
    if (!clinicId) return;

    const channel = supabase
      .channel(`served-calendar-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          setRefreshKey((value) => value + 1);
        }
      )
      .subscribe();

    const timer = window.setInterval(() => {
      setRefreshKey((value) => value + 1);
    }, 30000);

    const onFocus = () => {
      setRefreshKey((value) => value + 1);
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [supabase, clinicId]);

  // Handle Escape and focus when closing modal.
  useEffect(() => {
    if (!selectedDay) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedDay(null);
        dateButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedDay]);

  // Group served records by Philippine calendar date.
  const byDate = useMemo(() => {
    const grouped = new Map<string, ServedEntry[]>();

    for (const entry of records) {
      const key = manilaDateKey(
        entry.served_at ??
          entry.finished_at ??
          entry.created_at
      );

      const dayRecords = grouped.get(key) ?? [];

      dayRecords.push(entry);
      grouped.set(key, dayRecords);
    }

    return grouped;
  }, [records]);

  const selectedRecords = selectedDay
    ? byDate.get(selectedDay) ?? []
    : [];

  const estimatedDateCount = records.filter(
    (entry) =>
      !entry.served_at &&
      !entry.finished_at
  ).length;

  function openDate(
    day: string,
    button: HTMLButtonElement
  ) {
    dateButtonRef.current = button;
    setSelectedDay(day);
  }

  function closeModal() {
    setSelectedDay(null);
    dateButtonRef.current?.focus();
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 text-[#2E1747] sm:px-6 sm:pt-8 lg:px-8">

      {/* PAGE HEADER */}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">
            Patient visit records
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Served patients calendar
          </h1>

          <p className="mt-2 text-sm text-[#756581]">
            Select a date to view the names, queue
            numbers, and visit reasons of patients served.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setRefreshKey((value) => value + 1)
          }
          disabled={
            loading ||
            checkingAccess ||
            !clinicId
          }
          className="min-h-10 rounded-xl border border-[#D7C4EA] bg-white px-4 py-2 text-sm font-semibold text-[#6D3AA8] hover:bg-[#F2EAFF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh records
        </button>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* HISTORICAL RECORD WARNING */}

      {!loading && estimatedDateCount > 0 && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {estimatedDateCount.toLocaleString("en-PH")}{" "}
          older served{" "}
          {estimatedDateCount === 1
            ? "record has"
            : "records have"}{" "}
          no completion timestamp. These are displayed
          by the date the patient joined the queue,
          which may differ from the actual service date.
        </p>
      )}

      {/* CALENDAR CARD */}

      <section className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-sm">

        {/* MONTH HEADER */}

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4D5F6] p-4 sm:p-6">

          <div>
            <h2 className="text-xl font-bold">
              {monthTitle}
            </h2>

            <p
              className="mt-1 text-sm text-[#756581]"
              aria-live="polite"
            >
              {loading || checkingAccess
                ? "Loading served patient records…"
                : `${records.length.toLocaleString("en-PH")} patient${records.length === 1 ? "" : "s"} served this month`}
            </p>
          </div>

          {/* MONTH NAVIGATION */}

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={() => {
                setSelectedDay(null);
                setMonth((value) =>
                  shiftMonth(value, -1)
                );
              }}
              aria-label="Previous month"
              className="grid size-11 place-items-center rounded-xl border border-[#E4D5F6] text-[#6D3AA8] transition hover:bg-[#F2EAFF]"
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedDay(null);
                setMonth(
                  todayManila().slice(0, 7)
                );
              }}
              className="min-h-11 rounded-xl border border-[#E4D5F6] px-3 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF]"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedDay(null);
                setMonth((value) =>
                  shiftMonth(value, 1)
                );
              }}
              aria-label="Next month"
              className="grid size-11 place-items-center rounded-xl border border-[#E4D5F6] text-[#6D3AA8] transition hover:bg-[#F2EAFF]"
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

          </div>
        </div>

        {/* CALENDAR GRID */}

        <div className="p-2 sm:p-5">

          <div
            className="grid grid-cols-7 gap-1 sm:gap-2"
            role="grid"
            aria-label={`${monthTitle} served patient calendar`}
          >

            {/* WEEKDAY LABELS */}

            {WEEKDAYS.map((day) => (
              <div
                key={day}
                role="columnheader"
                className="py-2 text-center text-[11px] font-bold text-[#756581] sm:text-sm"
              >
                {day}
              </div>
            ))}

            {/* EMPTY CELLS BEFORE FIRST DAY */}

            {Array.from(
              {
                length:
                  calendar.firstDayOffset,
              },
              (_, index) => (
                <div
                  key={`blank-${index}`}
                  role="gridcell"
                  aria-hidden="true"
                />
              )
            )}

            {/* CALENDAR DAYS */}

            {Array.from(
              {
                length:
                  calendar.numberOfDays,
              },
              (_, index) => {
                const dayNumber = index + 1;

                const dateKey = `${month}-${String(
                  dayNumber
                ).padStart(2, "0")}`;

                const servedCount =
                  byDate.get(dateKey)?.length ?? 0;

                const isToday =
                  dateKey === today;

                const isSelected =
                  dateKey === selectedDay;

                return (
                  <div
                    role="gridcell"
                    key={dateKey}
                  >
                    <button
                      type="button"
                      onClick={(event) =>
                        openDate(
                          dateKey,
                          event.currentTarget
                        )
                      }
                      aria-label={`${dayLabel(dateKey)}, ${servedCount} patient${servedCount === 1 ? "" : "s"} served`}
                      aria-pressed={isSelected}
                      className={`flex min-h-20 w-full flex-col items-center justify-start gap-1 rounded-xl border px-1 py-2 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] sm:min-h-28 sm:px-2 sm:py-3 ${
                        isSelected
                          ? "border-[#6D3AA8] bg-[#F0E6FF]"
                          : servedCount > 0
                            ? "border-[#D8C5EE] bg-[#F8F3FF] hover:bg-[#F1E7FF]"
                            : "border-[#EFE8F7] bg-white hover:bg-[#FAF8FF]"
                      }`}
                    >

                      {/* DAY NUMBER */}

                      <span
                        className={`grid size-7 place-items-center rounded-full text-sm font-bold sm:size-8 ${
                          isToday
                            ? "bg-[#6D3AA8] text-white"
                            : "text-[#2E1747]"
                        }`}
                      >
                        {dayNumber}
                      </span>

                      {/* SERVED COUNT */}

                      <span
                        className={`text-[10px] font-semibold leading-4 sm:text-xs ${
                          servedCount > 0
                            ? "text-[#6D3AA8]"
                            : "text-[#988AA5]"
                        }`}
                      >
                        {servedCount} served
                      </span>

                    </button>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* CALENDAR EXPLANATION */}

        <p className="border-t border-[#F0EAF7] px-4 py-3 text-xs leading-5 text-[#80748B] sm:px-6">
          Records with a completion timestamp are grouped
          by the date they were served (Philippine time).
          Older served records without a completion
          timestamp are displayed under their queue-entry
          date as an approximation.
        </p>

      </section>

      {/* SELECTED DATE MODAL */}

      {selectedDay && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#241334]/60 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              closeModal();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="served-day-title"
            className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-[0_30px_100px_rgba(28,15,44,0.3)]"
          >

            {/* MODAL HEADER */}

            <div className="flex items-start justify-between gap-4 border-b border-[#E4D5F6] p-4 sm:p-6">

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B5CB5]">
                  Served patient records
                </p>

                <h2
                  id="served-day-title"
                  className="mt-1 text-lg font-bold sm:text-xl"
                >
                  {dayLabel(selectedDay)}
                </h2>

                <p className="mt-1 text-sm text-[#756581]">
                  {selectedRecords.length}{" "}
                  patient
                  {selectedRecords.length === 1
                    ? ""
                    : "s"}{" "}
                  served
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeModal}
                aria-label="Close patient details"
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#E4D5F6] text-[#6D3AA8] transition hover:bg-[#F2EAFF]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>

            </div>

            {/* PATIENT LIST */}

            <div className="overflow-y-auto p-4 sm:p-6">

              {selectedRecords.length === 0 ? (
                <p className="rounded-xl bg-[#FAF8FF] p-5 text-center text-sm text-[#756581]">
                  No served patients are recorded
                  for this date.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">

                  {selectedRecords.map(
                    (patient) => (
                      <li
                        key={patient.id}
                        className="flex items-start gap-3 rounded-xl border border-[#E4D5F6] bg-[#FCFAFF] p-4"
                      >

                        {/* QUEUE NUMBER */}

                        <span className="shrink-0 rounded-lg bg-[#F2EAFF] px-3 py-2 text-sm font-extrabold text-[#6D3AA8]">
                          #{patient.queue_number}
                        </span>

                        {/* PATIENT DETAILS */}

                        <div className="min-w-0 flex-1">

                          <p className="break-words font-bold text-[#2E1747]">
                            {patient.name}
                          </p>

                          <p className="mt-1 break-words text-sm text-[#756581]">
                            Reason:{" "}
                            {patient.visit_reason ||
                              "Not specified"}
                          </p>

                          <p className="mt-1 text-xs text-[#8B5CB5]">
                            {patient.served_at ||
                            patient.finished_at
                              ? `Served at ${servedTime(
                                  patient.served_at ??
                                    patient.finished_at!
                                )}`
                              : "Service time not recorded (date estimated)"}
                          </p>

                        </div>

                      </li>
                    )
                  )}

                </ul>
              )}

            </div>
          </section>
        </div>
      )}

    </main>
  );
}
