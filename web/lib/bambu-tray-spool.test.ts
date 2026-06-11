import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BambuTray, Spool } from "./types";
import { findSpoolForBambuTray, getSpoolActiveTrayId } from "./bambu-tray-spool";

const tray: BambuTray = {
  unique_id: "tray_unique_4",
  entity_id: "sensor.bambu_tray_4",
  tray_number: 4,
  ams_number: 1,
};

describe("getSpoolActiveTrayId", () => {
  it("reads plain active_tray value", () => {
    const spool: Spool = {
      id: 1,
      name: "PLA",
      brand: "Bambu",
      material: "PLA",
      location: "",
      remaining_weight: 500,
      used_weight: 0,
      extra: { active_tray: "tray_unique_4" },
    };
    assert.equal(getSpoolActiveTrayId(spool), "tray_unique_4");
  });

  it("parses JSON-quoted active_tray value", () => {
    const spool: Spool = {
      id: 1,
      name: "PLA",
      brand: "Bambu",
      material: "PLA",
      location: "",
      remaining_weight: 500,
      used_weight: 0,
      extra: { active_tray: '"tray_unique_4"' },
    };
    assert.equal(getSpoolActiveTrayId(spool), "tray_unique_4");
  });

  it("returns empty when active_tray is cleared", () => {
    const spool: Spool = {
      id: 1,
      name: "PLA",
      brand: "Bambu",
      material: "PLA",
      location: "",
      remaining_weight: 500,
      used_weight: 0,
      extra: { active_tray: '""' },
    };
    assert.equal(getSpoolActiveTrayId(spool), "");
  });
});

describe("findSpoolForBambuTray", () => {
  it("returns spool matching tray unique_id", () => {
    const spools: Spool[] = [
      {
        id: 1,
        name: "A",
        brand: "B",
        material: "PLA",
        location: "",
        remaining_weight: 500,
        used_weight: 0,
        extra: { active_tray: "tray_unique_4" },
      },
      {
        id: 2,
        name: "B",
        brand: "B",
        material: "PETG",
        location: "",
        remaining_weight: 400,
        used_weight: 0,
        extra: { active_tray: "other_tray" },
      },
    ];
    const match = findSpoolForBambuTray(tray, spools);
    assert.equal(match?.id, 1);
  });

  it("returns null when no spool is assigned to the tray", () => {
    const spools: Spool[] = [
      {
        id: 1,
        name: "A",
        brand: "B",
        material: "PLA",
        location: "",
        remaining_weight: 500,
        used_weight: 0,
        extra: { active_tray: "" },
      },
    ];
    assert.equal(findSpoolForBambuTray(tray, spools), null);
  });

  it("matches by entity_id when stored that way", () => {
    const spools: Spool[] = [
      {
        id: 3,
        name: "C",
        brand: "B",
        material: "ABS",
        location: "",
        remaining_weight: 300,
        used_weight: 0,
        extra: { active_tray: tray.entity_id },
      },
    ];
    assert.equal(findSpoolForBambuTray(tray, spools)?.id, 3);
  });
});
