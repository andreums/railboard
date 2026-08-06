export type DepartureCountdown =
  | { kind: "minutes"; minutes: number }
  | { kind: "passed" }
  | { kind: "unknown" };

// Real row shape today only has HH:mm strings (trains.scheduled_time /
// expected_time — TEXT columns, see backend/src/db.js). Full date/timestamp
// fields are checked defensively (priorities 1-2) in case the backend ever
// adds them, but are not fabricated here — see the getCandidateDate priority
// list below.
type CountdownSource = {
  scheduled_time?: string | null;
  expected_time?: string | null;
  // Not present in the current schema; read only if some future row shape
  // provides them, never assumed.
  scheduled_at?: string | null;
  expected_at?: string | null;
};

function parseFullDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// HH:mm (optionally HH:mm:ss) with strict range validation — rejects
// "25:00", "12:60", empty strings, and non-time garbage instead of silently
// producing NaN/absurd minute counts.
function parseHHMM(value?: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Minutes until departure, prioritizing full date/time data when available
 * and falling back to HH:mm-only comparison against `now` — see the module
 * doc comment for why only HH:mm exists in practice today.
 *
 * A negative HH:mm difference is only treated as "actually tomorrow" when
 * it's large (> 12h), matching the exact rule already used server-side for
 * the same kind of same-day HH:mm arithmetic (see
 * backend/src/services/trainGeneratorService.js minutesUntilHHMM). A small
 * negative difference means the train just left minutes ago — reported as
 * "passed", never as ~1439 minutes.
 */
export function computeDepartureCountdown(train: CountdownSource, now: Date): DepartureCountdown {
  // Priorities 1-2: full expected/scheduled date-time, if the row ever has it.
  const fullCandidate = parseFullDate(train.expected_at) || parseFullDate(train.scheduled_at);
  if (fullCandidate) {
    const minutes = Math.round((fullCandidate.getTime() - now.getTime()) / 60000);
    return minutes < 0 ? { kind: "passed" } : { kind: "minutes", minutes };
  }

  // Priorities 3-4: HH:mm only.
  const targetMinutes = parseHHMM(train.expected_time) ?? parseHHMM(train.scheduled_time);
  if (targetMinutes == null) return { kind: "unknown" };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let diff = targetMinutes - currentMinutes;
  if (diff < -12 * 60) diff += 24 * 60;
  if (diff > 12 * 60) diff -= 24 * 60;

  if (diff < 0) return { kind: "passed" };
  return { kind: "minutes", minutes: diff };
}

export function formatDepartureCountdown(countdown: DepartureCountdown): string {
  if (countdown.kind === "minutes") return `${countdown.minutes} min`;
  if (countdown.kind === "passed") return "0 min";
  return "-- min";
}
