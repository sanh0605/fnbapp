# Gate 4 MAC drift 12-line classification

Date: 2026-07-19  
Mode: read-only  
Structured evidence: `2026-07-19-gate4-mac-drift-12-line-classification.json`

## Verdict

All 12 lines are `BACKDATED_LEDGER_LIKE`. They intersect six durable
`backdated_ledger_events` whose effective timestamp is 2026-07-16 17:00 UTC
and whose visibility timestamp is 2026-07-18 12:43 UTC. Every sale happened
inside that effective-to-visible interval.

The counterfactual is exact for 12/12 lines: replaying without the ledger rows
that were not visible when the order was written reproduces the stored
`cost_at_sale` exactly. The current replay includes those later-visible rows
and produces the observed total delta of +10 VND. There are no
`LOCKED_VIOLATION_STORED` rows and no unresolved line.

This is the established Task 3.4 backdated-ledger fingerprint, not a new MAC
engine or recipe mechanism. No line was locked, recomputed, or mutated.

## Method

The script `scripts/investigate-gate4-mac-drift-12-lines.ts` reuses Task 3.4's
classification precedence:

1. match a consumed item to a durable event where
   `effective_timestamp <= sale_time <= visibility_timestamp`;
2. require the event to become visible after the line's latest write event;
3. classify that evidence as `BACKDATED_LEDGER_LIKE` before applying temporal
   fallback buckets;
4. replay without the matched late-visible ledger rows and compare against the
   stored value with the existing 1 VND tolerance.

Database access was limited to SELECT queries against orders, order lines,
stock ledger, recipes, semi-products, backdated events, and order events. The
only write was the local JSON evidence artifact.

## Six matched visibility events

| Event | Ledger row | Item | Effective at | Visible at |
|---|---|---|---|---|
| `173188ff-10ba-4cf0-9fd7-d68ffd3f3cb3` | `STK-12a32235-b535-45a4-8daf-b24af64cabda` | `ING-029` | 2026-07-16T17:00:00Z | 2026-07-18T12:43:23.08713Z |
| `3c01ac71-1079-4f2d-8c43-de0bef5694e7` | `STK-cdc47dfd-4b79-419f-8e01-b88004a7bb3c` | `ING-025` | 2026-07-16T17:00:00Z | 2026-07-18T12:43:23.08713Z |
| `796baf18-d5a1-40a0-8cad-2e253abe5f40` | `STK-52d4a281-ebb0-4e3b-95cf-ce113b3359f3` | `ING-016` | 2026-07-16T17:00:00Z | 2026-07-18T12:43:23.08713Z |
| `8f6d1b7d-3d00-46a0-8a35-7d2033163140` | `STK-e49bd50e-a412-4ff7-b80c-a53373068d41` | `ING-015` | 2026-07-16T17:00:00Z | 2026-07-18T12:43:23.08713Z |
| `b3b98840-76e7-400d-b2aa-eaf047418998` | `STK-869063f9-7d0c-4ec4-ba95-f20219511bfb` | `ING-005` | 2026-07-16T17:00:00Z | 2026-07-18T12:43:23.08713Z |
| `e6642f29-a8be-4dbb-8fa1-1e3353372f5c` | `STK-fbd7c19d-e7ef-4277-a867-30a0ef35fce3` | `ING-030` | 2026-07-16T17:00:00Z | 2026-07-18T12:43:23.08713Z |

## Per-line evidence

`Pre-visible replay` is the counterfactual after excluding the matched ledger
rows. It equals stored COGS in every row.

| Line | Order | Sale time | Product | Stored | Current replay | Delta | Pre-visible replay | BTP shortfall | Matched event(s) |
|---|---|---|---|---:|---:|---:|---:|---|---|
| `ol-86734b4a-9925-422e-ad90-501d2c651fea` | PHD001043 | 2026-07-17T01:43:24.193Z | PROD-005 | 7,109 | 7,307 | +198 | 7,109 | BTP-003 | `b3b98840` |
| `ol-2b7b1244-c9a8-4045-a63d-d98b97ca6d6f` | UCK000504 | 2026-07-17T06:00:09.359Z | PROD-022 | 9,645 | 9,843 | +198 | 9,645 | BTP-003 | `b3b98840` |
| `ol-c930bf7e-c1e4-43c6-af15-0904079c0b27` | UCK000506 | 2026-07-17T08:58:06.157Z | PROD-017 | 8,853 | 8,798 | -55 | 8,853 | BTP-009 | `e6642f29` |
| `ol-a588b03d-91a9-4489-9428-4868ebe6d332` | UCK000508 | 2026-07-17T11:12:17.308Z | PROD-022 | 9,645 | 9,843 | +198 | 9,645 | BTP-003 | `b3b98840` |
| `ol-98496671-cc91-4249-83ed-c48c22bb6bca` | UCK000509 | 2026-07-17T11:37:55.491Z | PROD-024 | 30,320 | 30,168 | -152 | 30,320 | BTP-011 | `173188ff`, `e6642f29` |
| `ol-aae02000-94c6-4218-86c8-c6f2b5a19a40` | UCK000510 | 2026-07-17T11:54:33.147Z | PROD-021 | 11,751 | 11,730 | -21 | 11,751 | none | `3c01ac71` |
| `ol-88a85567-d6eb-4289-be7e-cf2ed95906c4` | UCK000511 | 2026-07-17T12:22:37.178Z | PROD-017 | 8,853 | 8,798 | -55 | 8,853 | BTP-009 | `e6642f29` |
| `ol-07583683-fa83-486c-9c5e-8f07ab9862ef` | UCK000514 | 2026-07-17T12:54:32.713Z | PROD-015 | 9,757 | 9,752 | -5 | 9,757 | BTP-009 | `796baf18`, `8f6d1b7d` |
| `ol-89e75ec5-1f97-4d45-86d8-079369798ec3` | UCK000515 | 2026-07-17T13:24:19.483Z | PROD-024 | 30,320 | 30,168 | -152 | 30,320 | BTP-011 | `173188ff`, `e6642f29` |
| `ol-cb36fff8-4632-4b39-aa80-102e5b481592` | UCK000516 | 2026-07-17T13:24:29.239Z | PROD-020 | 11,687 | 11,674 | -13 | 11,687 | none | `796baf18` |
| `ol-3e30109c-f382-44fa-ae87-1997185ae604` | UCK000519 | 2026-07-17T15:53:16.679Z | PROD-024 | 15,160 | 15,084 | -76 | 15,160 | BTP-011 | `173188ff`, `e6642f29` |
| `ol-ce1887cf-96fc-49b1-b09c-487bf2379681` | UCK000520 | 2026-07-18T07:01:55.159Z | PROD-017 | 8,853 | 8,798 | -55 | 8,853 | BTP-009 | `e6642f29` |

## Gate decision

The 12-line addendum is resolved as a known mechanism and does not itself
block Gate 4. It remains read-only evidence; any lock or recovery decision is
outside this task.
