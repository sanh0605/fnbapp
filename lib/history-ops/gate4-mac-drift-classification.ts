export type Gate4MacBucket =
  | "BACKDATED_LEDGER_LIKE"
  | "PRE_BASELINE_WINDOW"
  | "BASELINE_SELECTION_GAP"
  | "POST_CUTOFF_NEW_DRIFT";

export type Gate4MacMechanism =
  | "BACKDATED_LEDGER_VISIBILITY"
  | "KNOWN_RECIPE_TIMING_REPLAY"
  | "KNOWN_SHORTFALL_FORMULA_REPLAY"
  | "UNRESOLVED";

export type Gate4MacLineEvidence = {
  saleTime: string;
  cutoff: string;
  baselineStart: string;
  causalBackdatedEventIds: string[];
  auditClassification: string;
  shortfallBtpIds: string[];
  saleRecipeReplayMatchesStored: boolean;
  currentReplayMatchesStored: boolean;
  compactReplayMatchesStored: boolean;
};

export function classifyGate4MacLine(
  evidence: Gate4MacLineEvidence,
): { bucket: Gate4MacBucket; mechanism: Gate4MacMechanism } {
  if (evidence.causalBackdatedEventIds.length > 0) {
    return {
      bucket: "BACKDATED_LEDGER_LIKE",
      mechanism: "BACKDATED_LEDGER_VISIBILITY",
    };
  }

  const saleMs = timestampMs(evidence.saleTime);
  const bucket: Gate4MacBucket = saleMs > timestampMs(evidence.cutoff)
    ? "POST_CUTOFF_NEW_DRIFT"
    : saleMs < timestampMs(evidence.baselineStart)
      ? "PRE_BASELINE_WINDOW"
      : "BASELINE_SELECTION_GAP";

  if (
    evidence.saleRecipeReplayMatchesStored
    && !evidence.currentReplayMatchesStored
  ) {
    return { bucket, mechanism: "KNOWN_RECIPE_TIMING_REPLAY" };
  }

  if (
    evidence.auditClassification === "BTP_SHORTFALL"
    && evidence.shortfallBtpIds.length > 0
    && evidence.compactReplayMatchesStored
    && !evidence.currentReplayMatchesStored
  ) {
    return { bucket, mechanism: "KNOWN_SHORTFALL_FORMULA_REPLAY" };
  }

  return { bucket, mechanism: "UNRESOLVED" };
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}
