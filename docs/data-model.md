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
| **Total** (limit 25 / 25) | 15 | 15 |

Load: ~100 puts per hourly run (one WCU each, item < 1 KB, a failed condition still consumes it); a few reads per page view. ~400 B per item → well under 1 GB per year. A single `kind` partition on the GSI is fine at this volume.

No auto scaling (it creates CloudWatch alarms). Retention / TTL is out of scope for 02.


## `threads` table (DynamoDB, slice 09 →)

Single-table design for everything that is not a raw Event (ADR 0009). Created in slice 09 as `foresight-<environment>-threads`: partition key `pk`, sort key `sk`, **no indexes**, provisioned 5/5, TTL on `expiresAt`.

| `pk` | `sk` | Item | Slice |
|---|---|---|---|
| `BUDGET#<UTC day>` | `MODEL#<model id>` | Daily token counter: `tokens` (N), `expiresAt` (epoch seconds, day + 30 days) | 09 |
| `THREAD#<id>` | `META` | Thread: name, status, last Event | 10 |
| `THREAD#<id>` | `EVENT#<publishedAt>#<event id>` | Timeline entry (short copy of the dispatch) | 10 |
| `THREAD#<id>` | `REPORT#<createdAt>` | Situation report version | 10 |
| `THREADS` | `<thread id>` | Entry in the list of Threads | 10 |

### Access patterns (slice 09)

| Pattern | How |
|---|---|
| Tokens spent today by a model | `GetItem` on `BUDGET#<day>` / `MODEL#<model>`; missing item = 0. Read once per run. |
| Count a call | `UpdateItem`: `ADD tokens :n SET expiresAt = if_not_exists(expiresAt, :ttl)`, `ReturnValues = UPDATED_NEW`. Atomic, so a counter is never lost. |

The worker role may `GetItem` / `UpdateItem` only items whose partition key starts with `BUDGET#` (`dynamodb:LeadingKeys`).

### Capacity — all tables

| | RCU | WCU |
|---|---|---|
| `events` + 2 indexes | 15 | 15 |
| `threads` | 5 | 5 |
| **Total** (limit 25 / 25) | 20 | 20 |
