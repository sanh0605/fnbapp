"use client";

import type {
  StocktakeSessionView,
  RecentConfirmedStocktakeSessionView,
} from "../actions";
import { ActiveSessionView } from "./ActiveSessionView";
import {
  StartSessionView,
  LastConfirmedSessionPanel,
} from "./StocktakeSessionPanels";

export function StocktakeClient({
  session,
  lastConfirmed,
}: {
  session: StocktakeSessionView | null;
  lastConfirmed: RecentConfirmedStocktakeSessionView | null;
}) {
  return (
    <div className="space-y-6">
      {session ? <ActiveSessionView session={session} /> : <StartSessionView />}
      {lastConfirmed && <LastConfirmedSessionPanel session={lastConfirmed} />}
    </div>
  );
}
