export type ArrivalWindow = "early" | "grace" | "late";

export type ArrivalTiming = {
  window: ArrivalWindow;
  minutesAfterStart: number;
  minutesPastGrace: number;
};

/**
 * Classifies an appointment arrival against the clinic's grace period.
 * A patient is only late after the full grace period has elapsed.
 */
export function getArrivalTiming(
  startsAt: string,
  arrivedAt: string | number | Date,
  graceMinutes: number,
): ArrivalTiming {
  const start = new Date(startsAt).getTime();
  const arrival = new Date(arrivedAt).getTime();
  const safeGrace = Math.max(0, graceMinutes || 0);
  const minutesAfterStart = Math.max(0, Math.floor((arrival - start) / 60000));

  if (arrival <= start) {
    return { window: "early", minutesAfterStart: 0, minutesPastGrace: 0 };
  }

  if (arrival <= start + safeGrace * 60000) {
    return { window: "grace", minutesAfterStart, minutesPastGrace: 0 };
  }

  return {
    window: "late",
    minutesAfterStart,
    minutesPastGrace: Math.max(1, minutesAfterStart - safeGrace),
  };
}
