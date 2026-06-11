import type { BambuTray, Spool } from "@/lib/types";

const ACTIVE_TRAY_KEY = "active_tray";

/** Parses Spoolman extra field values (plain or JSON-quoted strings). */
function parseExtraString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed) as string;
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/** Returns the HA tray unique_id stored on a spool (Spoolman extra.active_tray). */
export function getSpoolActiveTrayId(spool: Spool): string {
  if (!spool.extra) return "";
  return parseExtraString(spool.extra[ACTIVE_TRAY_KEY]);
}

/** Finds the spool assigned to a Bambu tray via Spoolman active_tray. */
export function findSpoolForBambuTray(
  tray: BambuTray,
  spools: Spool[]
): Spool | null {
  for (const spool of spools) {
    const activeTray = getSpoolActiveTrayId(spool);
    if (!activeTray) continue;
    if (activeTray === tray.unique_id || activeTray === tray.entity_id) {
      return spool;
    }
  }
  return null;
}
