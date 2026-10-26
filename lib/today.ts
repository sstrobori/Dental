// Time helpers. The clinic works in Manila time (UTC+8, no daylight saving).

export function todayManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD
}

export function addDaysManila(days: number): string {
  return new Date(Date.now() + days * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// Start of today in Manila time, as an ISO string for database filters.
export function startOfTodayManila(): string {
  return new Date(`${todayManila()}T00:00:00+08:00`).toISOString();
}

// Start and end of a given Manila day (YYYY-MM-DD).
export function dayRangeManila(day: string): [string, string] {
  const start = new Date(`${day}T00:00:00+08:00`);
  return [start.toISOString(), new Date(start.getTime() + 86400000).toISOString()];
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// "Estimated turn: around 3:45 PM (about 25 min)" for a rough number of minutes.
export function estimateLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "";
  if (minutes <= 0) return "Estimated turn: any moment now";
  const t = new Date(Math.round((Date.now() + minutes * 60000) / 300000) * 300000); // nearest 5 minutes
  const clock = t.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
  return `Estimated turn: around ${clock} (about ${minutes} min)`;
}