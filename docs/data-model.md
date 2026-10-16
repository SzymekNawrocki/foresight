# Data model

## `events` table (DynamoDB, slices 02–03)

One item per Event. Created in 02b as `foresight-<environment>-events`.

| Attribute | Type | Notes |
|---|---|---|
| `id` | S | **Partition key.** First 32 hex chars of SHA-256 of the canonical link (fragment and tracking parameters removed). The same article read again maps to the same id. |
| `source` | S | Source id, e.g. `bbc-world` |
| `title` | S | ≤ 300 chars, whitespace collapsed |
| `url` | S | Canonical https link, ≤ 2048 chars |
| `publishedAt` | S | ISO 8601 UTC; fetch time if the feed gives no readable date |
| `fetchedAt` | S | ISO 8601 UTC |
| `kind` | S | Always `EVENT`; partition key of the `latest` index |
| `pending` | S | `EVENT` while the Event waits for its AI Analysis; partition key of the sparse `pending` index. Written only for new Events, removed when the Analysis is saved (slice 03). |
| `analysis` | M | The AI Analysis (`Analysis` in `packages/shared/src/analysis.ts`); absent until analyzed. |

Schema: `Event` in `packages/shared/src/event.ts`.

### Access patterns

| Pattern | How |
|---|---|
| Store an Event once | `PutItem` with `attribute_not_exists(id)`; a failed condition = duplicate |
| Latest N Events (02c) | Query GSI `latest` (`kind = EVENT`, sort key `publishedAt`), `ScanIndexForward = false`, `Limit = N`. The web role may `dynamodb:Query` on `…/index/latest` only. |
| Events waiting for Analysis (03) | Query GSI `pending` (`pending = EVENT`, sort key `publishedAt`), newest first, `Limit = 10`. Ingest role only. |
| Save an Analysis (03) | `UpdateItem`: `SET analysis REMOVE pending`, condition `attribute_exists(id)`. One write takes the Event off the queue. |

### Capacity — 0 PLN

DynamoDB is always free only in **provisioned** mode: 25 RCU + 25 WCU and 25 GB per account and Region. On-demand has no free request allowance.

| | RCU | WCU |
|---|---|---|
| Table | 5 | 5 |
| GSI `latest` | 5 | 5 |
| GSI `pending` | 5 | 5 |
| Table `theses` (06) | 3 | 3 |
| **Total** (limit 25 / 25) | 18 | 18 |

Load: ~100 puts per hourly run (one WCU each, item < 1 KB, a failed condition still consumes it); a few reads per page view. ~400 B per item → well under 1 GB per year. A single `kind` partition on the GSI is fine at this volume.

No auto scaling (it creates CloudWatch alarms). Retention / TTL is out of scope for 02.

## `theses` table (DynamoDB, slice 06)

One item per Thesis (CONTEXT.md: Teza). Private to the owner.

| Attribute | Type | Notes |
|---|---|---|
| `owner` | S | **Partition key.** Cognito `sub` of the author, taken from the verified access token — never from the request body. |
| `id` | S | **Sort key.** `<createdAt ISO>#<8 random hex>`: sortable by time, unique. |
| `eventId`, `eventTitle` | S | The Event the Thesis was placed under (title copied, so the Thesis survives Event clean-up). |
| `instrument`, `direction`, `horizonDays`, `rationale` | S/S/N/S | What the owner chose (`NewThesis` in `packages/shared/src/thesis.ts`). |
| `regions`, `topics` | L | Copied from the Event's Analysis on the server, for accuracy per Region / Topic (07). |
| `createdAt`, `resolveAt`, `status` | S | `resolveAt = createdAt + Horizon`; `status` = `open` until slice 07 resolves it. |

| Pattern | How |
|---|---|
| Place a Thesis | `PutItem` with `attribute_not_exists(id)` (web role) |
| Owner's Theses, newest first | `Query owner = :sub`, `ScanIndexForward = false` (web role) |
| Read one Event when placing | `GetItem` on `events` (web role; no Scan) |

### Rozstrzygnięcie (slice 07)

Set on the same item by the daily resolve run (the `ingest` Lambda with `{"task":"resolve"}`, 06:00 UTC):

| Attribute | Type | Notes |
|---|---|---|
| `entryPrice` | N | First US close after `createdAt` (from 20:00 UTC on, the next trading day — no peeking at a known close). |
| `exitPrice` | N | First US close after `resolveAt`, same rule. |
| `actual` | S | `up` / `down` / `flat` — `flat` when the move is within ±2% of `entryPrice`. |
| `hit` | BOOL | `actual == direction`. |
| `status`, `resolvedAt` | S | `resolved` + time of the run. |

| Pattern | How |
|---|---|
| Open Theses of every owner | `Scan` with `status = open` (ingest role; tiny table, once a day) |
| Write the outcome | `UpdateItem` `SET …` with condition `status = open` — a resolved Thesis is never rewritten |

Prices: Tiingo end-of-day API (free Starter plan, personal use: 50 requests/hour, 1,000/day, 500 symbols/month). One request per Instrument with something due — at most 20 a day.
