import { describe, expect, it } from "vitest";

import {
  classifyGate4MacLine,
  type Gate4MacLineEvidence,
} from "./gate4-mac-drift-classification";

const baseEvidence: Gate4MacLineEvidence = {
  saleTime: "2026-07-17T01:00:00.000Z",
  cutoff: "2026-07-02T23:59:59.999Z",
  baselineStart: "2026-06-07T00:00:00.000Z",
  causalBackdatedEventIds: [],
  auditClassification: "BTP_SHORTFALL",
  shortfallBtpIds: ["BTP-002"],
  saleRecipeReplayMatchesStored: true,
  currentReplayMatchesStored: false,
  compactReplayMatchesStored: false,
};

describe("classifyGate4MacLine", () => {
  it("gives a causal backdated event precedence over the temporal bucket", () => {
    expect(classifyGate4MacLine({
      ...baseEvidence,
      causalBackdatedEventIds: ["BDLE-001"],
    })).toEqual({
      bucket: "BACKDATED_LEDGER_LIKE",
      mechanism: "BACKDATED_LEDGER_VISIBILITY",
    });
  });

  it("classifies a post-cutoff sale with an exact sale-recipe replay as known recipe timing", () => {
    expect(classifyGate4MacLine(baseEvidence)).toEqual({
      bucket: "POST_CUTOFF_NEW_DRIFT",
      mechanism: "KNOWN_RECIPE_TIMING_REPLAY",
    });
  });

  it("recognizes the established compact-versus-full shortfall formula fingerprint", () => {
    expect(classifyGate4MacLine({
      ...baseEvidence,
      saleRecipeReplayMatchesStored: false,
      compactReplayMatchesStored: true,
    })).toEqual({
      bucket: "POST_CUTOFF_NEW_DRIFT",
      mechanism: "KNOWN_SHORTFALL_FORMULA_REPLAY",
    });
  });

  it("keeps an unreproduced post-cutoff mismatch unresolved", () => {
    expect(classifyGate4MacLine({
      ...baseEvidence,
      auditClassification: "MAC_REPRICE",
      shortfallBtpIds: [],
      saleRecipeReplayMatchesStored: false,
    })).toEqual({
      bucket: "POST_CUTOFF_NEW_DRIFT",
      mechanism: "UNRESOLVED",
    });
  });

  it("preserves the Task 3.4 pre-window and baseline-gap temporal buckets", () => {
    expect(classifyGate4MacLine({
      ...baseEvidence,
      saleTime: "2026-05-01T00:00:00.000Z",
    }).bucket).toBe("PRE_BASELINE_WINDOW");
    expect(classifyGate4MacLine({
      ...baseEvidence,
      saleTime: "2026-06-20T00:00:00.000Z",
    }).bucket).toBe("BASELINE_SELECTION_GAP");
  });
});
