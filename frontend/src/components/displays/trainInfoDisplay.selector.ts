import { isFinalStatus } from "../../lib/trainStatus";

// Shape of a board row as actually returned by
// displayScreens.getBoard() (backend/src/db.js): a plain SQL join over
// `trains` + operators/train_types/stations, already filtered by
// station_id and (for PLATFORM/TRAIN_INFO screens) by `platform` when the
// screen has one configured. `sector` is NOT filtered server-side.
export type TrainInfoRow = {
  id?: number | string | null;
  number?: string | null;
  number2?: string | null;
  destination?: string | null;
  destination2?: string | null;
  platform?: string | null;
  sector?: string | null;
  scheduled_time?: string | null;
  expected_time?: string | null;
  status?: string | null;
  stops?: unknown;
  observations?: string | null;
  operator_name?: string | null;
  operator_logo?: string | null;
  type_code?: string | null;
  type_name?: string | null;
  type_color?: string | null;
  type_logo?: string | null;
};

// The subset of DisplayScreen actually used to pick a train. Kept narrow and
// structural (rather than importing the full DisplayScreen type) so this
// module stays independently testable.
export type TrainInfoScreenConfig = {
  platform?: string | null;
  sector?: string | null;
};

function normalizeMatchValue(value?: string | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed === "-" ? "" : trimmed;
}

/**
 * Selects the train a TRAIN_INFO screen should display.
 *
 * IMPORTANT — backend limitation: `DisplayScreen` has no field that pins a
 * screen to one specific train (no train_id / train_number / service_id).
 * The only real, existing selectors are `station_id` (already applied by
 * getBoard()) and `platform`/`sector` (platform is applied server-side;
 * sector is not, so it's re-applied here). Given that, "the" train for the
 * screen is a provisional, documented fallback: the earliest non-final
 * (not Departed/Arrived) row left after matching platform/sector, relying
 * on the backend's existing `sort_order ASC, scheduled_time ASC` ordering.
 * A real fix would add a stable per-screen train reference (e.g.
 * `display_screens.pinned_train_id`) so screens don't silently reassign to
 * a different train when the "first" one changes.
 */
export function selectTrainInfoTrain<T extends TrainInfoRow>(
  rows: readonly T[] | null | undefined,
  screen: TrainInfoScreenConfig | null | undefined,
  // Accepted for API stability / determinism in tests. Not used today:
  // the app has no existing "how stale is too stale" rule beyond status
  // (see backend automationService.js state machine, which already
  // transitions trains to Departed/Arrived over time) — inventing an extra
  // time-based cutoff here would be behavior not present anywhere else.
  _now?: Date,
): T | undefined {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;

  const wantedPlatform = normalizeMatchValue(screen?.platform);
  const wantedSector = normalizeMatchValue(screen?.sector);

  return rows.find((row) => {
    if (isFinalStatus(row.status)) return false;
    if (wantedPlatform && normalizeMatchValue(row.platform) !== wantedPlatform) return false;
    if (wantedSector && normalizeMatchValue(row.sector) !== wantedSector) return false;
    return true;
  });
}

/** Stable identity for the currently selected journey — resets pagination/timers when it changes. */
export function journeyKeyFor(train: TrainInfoRow | null | undefined): string {
  if (!train) return "";
  if (train.id != null && train.id !== "") return `id:${train.id}`;
  return ["fallback", train.number ?? "", train.scheduled_time ?? "", train.destination ?? ""].join("|");
}
