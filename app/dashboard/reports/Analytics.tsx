"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayManila } from "@/lib/today";

type Day = { weekday: number; total: number; days: number; per_day: number };
type Mon = { month: number; total: number };
type Data = { first_date: string | null; weeks_used: number; weekdays: Day[]; months: Mon[] };

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Analytics({ clinicId }: { clinicId: string }) {
  const supabase = createClient();
  const thisYear = Number(todayManila().slice(0, 4));
  const [measure, setMeasure] = useState<"served" | "all">("served");
  const [weeks, setWeeks] = useState(12);
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data, error } = await supabase.rpc("peak_analytics", {
      p_clinic_id: clinicId, p_weeks: weeks, p_year: year, p_measure: measure,
    });
    if (error) { setData(null); return setError(error.message); }
    setData(data as Data);
  }, [supabase, clinicId, weeks, year, measure]);

  useEffect(() => {
    load();
  }, [load]);

  const firstYear = data?.first_date ? Number(data.first_date.slice(0, 4)) : thisYear;
  const years: number[] = [];
  for (let y = thisYear; y >= Math.min(firstYear, thisYear); y--) years.push(y);

  const days = data?.weekdays ?? [];
  const maxPerDay = Math.max(0, ...days.map((d) => Number(d.per_day)));
  const topDays = days.filter((d) => maxPerDay > 0 && Number(d.per_day) === maxPerDay);

  const months = data?.months ?? [];
  const maxMonth = Math.max(0, ...months.map((m) => Number(m.total)));
  const topMonths = [...months]
    .filter((m) => Number(m.total) > 0)
    .sort((a, b) => Number(b.total) - Number(a.total))
    .slice(0, 3);
  const currentMonth = Number(todayManila().slice(5, 7));

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">Busy days and months</h2>
      <p className="mt-1 text-sm text-gray-600">
        Use this to plan staffing and opening hours. It counts queue visits since your clinic started using the app.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label>Count{" "}
          <select className="rounded border p-1" value={measure} onChange={(e) => setMeasure(e.target.value as "served" | "all")}>
            <option value="served">Patients served</option>
            <option value="all">Everyone who joined</option>
          </select>
        </label>
        <label>Weekdays over the last{" "}
          <select className="rounded border p-1" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {[4, 8, 12, 26, 52].map((w) => <option key={w} value={w}>{w} weeks</option>)}
          </select>
        </label>
        <label>Months of{" "}
          <select className="rounded border p-1" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && (
        <>
          <div className="mt-6 rounded-lg border p-4">
            <h3 className="font-semibold">Busiest day of the week</h3>
            <p className="mt-1 text-sm">
              {topDays.length === 0
                ? "No visits recorded in this period yet."
                : <>Busiest: <b>{topDays.map((d) => DAY_NAMES[d.weekday - 1]).join(" and ")}</b>, about {maxPerDay} patients on a typical one.</>}
            </p>
            <p className="text-xs text-gray-500">
              Average per day, from the last {data.weeks_used} {data.weeks_used === 1 ? "week" : "weeks"} of data.
              {data.weeks_used < 4 && " That is not much history yet, so treat this as a rough picture."}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {days.map((d) => {
                const top = maxPerDay > 0 && Number(d.per_day) === maxPerDay;
                return (
                  <div key={d.weekday} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0">{DAY_NAMES[d.weekday - 1]}</span>
                    <div className="h-5 flex-1 rounded bg-gray-100">
                      <div className={`h-5 rounded ${top ? "bg-[#1fa89a]" : "bg-[#12303f]"}`}
                        style={{ width: `${maxPerDay ? (Number(d.per_day) / maxPerDay) * 100 : 0}%` }} />
                    </div>
                    <span className="w-36 shrink-0 text-right text-xs text-gray-600">
                      {d.per_day} per day · {d.total} total
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-lg border p-4">
            <h3 className="font-semibold">Busiest months of {year}</h3>
            <p className="mt-1 text-sm">
              {topMonths.length === 0
                ? "No visits recorded in this year yet."
                : <>Peak months: <b>{topMonths.map((m) => MONTH_NAMES[m.month - 1]).join(", ")}</b>.</>}
            </p>
            <p className="text-xs text-gray-500">
              Total visits per month.{year === thisYear && ` ${MONTH_NAMES[currentMonth - 1]} is still in progress.`}
              {" "}Seasonal patterns only become reliable after a full year or more of data.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {months.map((m) => {
                const top = topMonths.some((t) => t.month === m.month);
                return (
                  <div key={m.month} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0">{MONTH_NAMES[m.month - 1]}</span>
                    <div className="h-5 flex-1 rounded bg-gray-100">
                      <div className={`h-5 rounded ${top ? "bg-[#1fa89a]" : "bg-[#12303f]"}`}
                        style={{ width: `${maxMonth ? (Number(m.total) / maxMonth) * 100 : 0}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-gray-600">{m.total} visits</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}