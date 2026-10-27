
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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  ).toISOString().slice(0, 7);

  return {
    firstDayOffset,
    numberOfDays,
    beginning: `${month}-01T00:00:00+08:00`,
    end: `${followingMonth}-01T00:00:00+08:00`,
  };
}

function shiftMonth(month: string, shift: number) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(
    Date.UTC(year, monthNumber - 1 + shift, 1)
  ).toISOString().slice(0, 7);
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

function completionTimestamp(entry: ServedEntry) {
  return (
    entry.served_at ??
    entry.finished_at ??
    entry.created_at
  );
}

export default function ServedCalendarPage() {
  const supabase = useMemo(() => createClient(), []);

  const [clinicId, setClinicId] = useState<string | null>(
    null
  );

  const [checkingAccess, setCheckingAccess] =
    useState(true);

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

  const closeButtonRef = useRef<HTMLButtonElement | null>(
    null
  );

  const dateButtonRef = useRef<HTMLButtonElement | null>(
    null
  );

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

  // IDENTIFY STAFF CLINIC

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

  // LOAD SERVED PATIENTS

  useEffect(() => {
    if (!clinicId) return;

    let cancelled = false;
    const batchSize = 500;

    async function loadMonth() {
      setLoading(true);
      setError("");

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

        // Fallback if served_at doesn't exist.

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

  // REAL-TIME AND AUTOMATIC REFRESH

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

  // CLOSE MODAL USING ESCAPE KEY

  useEffect(() => {
    if (!selectedDay) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedDay]);

  // GROUP RECORDS BY DATE

  const byDate = useMemo(() => {
    const grouped = new Map<string, ServedEntry[]>();

    for (const entry of records) {
      const key = manilaDateKey(
        completionTimestamp(entry)
      );

      const rows = grouped.get(key) ?? [];

      rows.push(entry);
      grouped.set(key, rows);
    }

    for (const rows of grouped.values()) {
      rows.sort(
        (a, b) =>
          new Date(completionTimestamp(a)).getTime() -
          new Date(completionTimestamp(b)).getTime()
      );
    }

    return grouped;
  }, [records]);

  const daysWithVisits = byDate.size;

  const estimatedDateCount = records.filter(
    (entry) =>
      !entry.served_at &&
      !entry.finished_at
  ).length;

  const selectedRecords = selectedDay
    ? byDate.get(selectedDay) ?? []
    : [];

  const selectedCount = selectedRecords.length;

  function openDate(
    day: string,
    button: HTMLButtonElement
  ) {
    dateButtonRef.current = button;
    setSelectedDay(day);
  }

  function closeModal() {
    setSelectedDay(null);

    window.requestAnimationFrame(() => {
      dateButtonRef.current?.focus();
    });
  }

  function changeMonth(direction: number) {
    setSelectedDay(null);
    setRecords([]);

    setMonth((current) =>
      shiftMonth(current, direction)
    );
  }

  return (
    <main className="w-full px-4 pb-12 pt-6 text-[#2E1747] sm:px-6 sm:pt-8 lg:px-8">

      {/* PAGE HEADER */}

      <div className="mb-6">

        <div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Served patients calendar
          </h1>
        </div>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* CALENDAR */}

      <section
        aria-label="Served patients by month"
        className="overflow-hidden rounded-2xl border border-[#E4D5F6] bg-white shadow-sm"
      >

        {/* MONTH HEADER */}

        <div className="flex flex-col gap-4 border-b border-[#EDE5F5] p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8B5CB5]">
              Monthly calendar
            </p>

            <h2 className="mt-1 text-xl font-bold sm:text-2xl">
              {monthTitle}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">

            {/* MONTHLY TOTAL */}

            <div className="mr-auto flex items-center gap-3 rounded-xl bg-[#F7F2FF] px-3 py-2.5 sm:px-4">

              <span className="text-2xl font-extrabold tabular-nums text-[#6D3AA8]">
                {loading || checkingAccess
                  ? "—"
                  : records.length.toLocaleString("en-PH")}
              </span>

              <span className="text-xs font-semibold leading-4 text-[#5C327F]">
                Patients
                <br />
                served
              </span>
            </div>

            {/* MONTH NAVIGATION */}

            <div
              className="flex items-center gap-1.5"
              aria-label="Change calendar month"
            >

              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
                className="grid h-11 w-11 place-items-center rounded-xl border border-[#E4D5F6] bg-white text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
              >
                <svg
                  className="h-5 w-5"
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
                  setRecords([]);

                  setMonth(
                    todayManila().slice(0, 7)
                  );

                  setRefreshKey(
                    (value) => value + 1
                  );
                }}
                className="min-h-11 rounded-xl border border-[#E4D5F6] bg-white px-3 text-sm font-semibold text-[#5C327F] transition hover:bg-[#F2EAFF]"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
                className="grid h-11 w-11 place-items-center rounded-xl border border-[#E4D5F6] bg-white text-[#6D3AA8] transition hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
              >
                <svg
                  className="h-5 w-5"
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
        </div>

        {/* CALENDAR GRID */}

        <div className="px-2 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-5">

          <div
            className="grid grid-cols-7 gap-1 sm:gap-2"
            aria-label={`${monthTitle} calendar`}
          >

            {/* WEEKDAY HEADINGS */}

            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-bold text-[#756581] sm:text-sm"
              >
                {day}
              </div>
            ))}

            {/* EMPTY DAYS BEFORE MONTH */}

            {Array.from(
              {
                length: calendar.firstDayOffset,
              },
              (_, index) => (
                <div
                  key={`blank-${index}`}
                  aria-hidden="true"
                />
              )
            )}

            {/* CALENDAR DATES */}

            {Array.from(
              {
                length: calendar.numberOfDays,
              },
              (_, index) => {
                const dayNumber = index + 1;

                const dateKey = `${month}-${String(
                  dayNumber
                ).padStart(2, "0")}`;

                const servedCount =
                  byDate.get(dateKey)?.length ?? 0;

                const isToday = dateKey === today;
                const isSelected =
                  dateKey === selectedDay;

                const hasVisits = servedCount > 0;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={(event) =>
                      openDate(
                        dateKey,
                        event.currentTarget
                      )
                    }
                    aria-label={`${dayLabel(dateKey)}: ${servedCount} ${
                      servedCount === 1
                        ? "patient"
                        : "patients"
                    } served. View details.`}
                    aria-pressed={isSelected}
                    className={`flex min-h-[72px] min-w-0 flex-col items-start rounded-xl border p-1.5 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCCAF3] sm:min-h-[108px] sm:p-3 ${                      isSelected
                        ? "border-[#6D3AA8] bg-[#F0E6FF] ring-1 ring-[#6D3AA8]"
                        : hasVisits
                          ? "border-[#E4D5F6] bg-[#FCFAFF] hover:border-[#BA95E3] hover:bg-[#F7F0FF]"
                          : "border-[#EEE8F4] bg-white hover:bg-[#FAF8FF]"
                    }`}
                  >


                  {/* DATE NUMBER - UPPER LEFT */}

                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums sm:h-8 sm:w-8 sm:text-sm ${
                      isToday
                        ? "bg-[#6D3AA8] text-white"
                        : "text-[#49365E]"
                    }`}
                  >
                    {dayNumber}
                  </span>

                  {/* SERVED COUNT - ONLY WHEN THERE ARE PATIENTS */}

                  {/* SERVED COUNT - CENTERED */}

                  {servedCount > 0 && (
                    <span className="mt-auto block w-full pb-1 text-center text-[11px] font-semibold leading-4 text-[#6D3AA8] sm:text-sm">
                      {servedCount} served
                    </span>
                  )}

                  </button>
                );
              }
            )}

          </div>
        </div>

        {/* LEGEND */}

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-[#EDE5F5] bg-[#FCFAFF] px-4 py-3 text-xs text-[#756581] sm:px-6">

          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full bg-[#6D3AA8]"
              aria-hidden="true"
            />

          <span>
            Dates with completed visits show the number of patients served.
          </span>
          </div>

          {!loading &&
            !checkingAccess &&
            !error && (
              <span>
                {daysWithVisits}{" "}
                {daysWithVisits === 1
                  ? "day"
                  : "days"}{" "}
                with completed visits
              </span>
            )}

        </div>
      </section>

      {/* OLDER RECORD NOTICE */}

      {!loading && estimatedDateCount > 0 && (
        <p
          role="note"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"
        >
          {estimatedDateCount} older{" "}
          {estimatedDateCount === 1
            ? "visit has"
            : "visits have"}{" "}
          no recorded completion time. Those visits
          appear on their queue-entry dates, which
          may not be the actual dates served.
        </p>
      )}

      {/* DATE DETAILS MODAL */}

      {selectedDay && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#241334]/60 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
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

            <header className="flex items-start justify-between gap-3 border-b border-[#EDE5F5] p-4 sm:p-6">

              <div className="min-w-0">

                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8B5CB5]">
                  Daily visit summary
                </p>

                <h2
                  id="served-day-title"
                  className="mt-1 text-lg font-extrabold sm:text-xl"
                >
                  {dayLabel(selectedDay)}
                </h2>

                <span className="mt-3 inline-flex rounded-full bg-[#F2EAFF] px-3 py-1.5 text-xs font-bold text-[#6D3AA8]">
                  {selectedCount}{" "}
                  {selectedCount === 1
                    ? "patient"
                    : "patients"}{" "}
                  served
                </span>

              </div>

              {/* CLOSE MODAL */}

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeModal}
                aria-label="Close visit details"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#E4D5F6] text-[#6D3AA8] hover:bg-[#F2EAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E4D5F6]"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>

            </header>

            {/* PATIENT LIST */}

            <div className="overflow-y-auto p-4 sm:p-6">

              {selectedCount === 0 ? (
                <p className="rounded-xl bg-[#FAF8FF] p-5 text-center text-sm text-[#756581]">
                  No served patients recorded
                  for this day.
                </p>
              ) : (
                <ul className="space-y-3">

                  {selectedRecords.map((patient) => {
                    const time =
                      patient.served_at ??
                      patient.finished_at;

                    return (
                      <li
                        key={patient.id}
                        className="flex items-start gap-3 rounded-xl border border-[#E4D5F6] bg-white p-4"
                      >

                        {/* QUEUE NUMBER */}

                        <div className="min-w-[3rem] rounded-lg bg-[#F2EAFF] px-2 py-2 text-center text-sm font-extrabold tabular-nums text-[#6D3AA8]">
                          #{patient.queue_number}
                        </div>

                        {/* PATIENT DETAILS */}

                        <div className="min-w-0 flex-1">

                          <p className="break-words font-bold text-[#2E1747]">
                            {patient.name}
                          </p>

                          <p className="mt-1 break-words text-sm text-[#756581]">
                            {patient.visit_reason ||
                              "Reason not specified"}
                          </p>

                          <p className="mt-2 text-xs font-semibold text-[#6D3AA8]">
                            {time
                              ? `Served at ${servedTime(time)}`
                              : "Completion time not recorded · date estimated"}
                          </p>

                        </div>

                      </li>
                    );
                  })}

                </ul>
              )}

            </div>
          </section>
        </div>
      )}

    </main>
  );
}
