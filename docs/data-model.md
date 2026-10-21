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
| `pending` | S | Source tier (`A`, `B`, `C`) while the Event waits for its AI Analysis; partition key of the sparse `pending` index. Written only for new Events, removed when the Analysis is saved (slice 03). Events queued before slice 10 carry `EVENT`. |
| `analysis` | M | The AI Analysis (`Analysis` in `packages/shared/src/analysis.ts`); absent until analyzed. |

Schema: `Event` in `packages/shared/src/event.ts`.

### Access patterns

| Pattern | How |
|---|---|
| Store an Event once | `PutItem` with `attribute_not_exists(id)`; a failed condition = duplicate |
| Latest N Events (02c) | Query GSI `latest` (`kind = EVENT`, sort key `publishedAt`), `ScanIndexForward = false`, `Limit = N`. The web role may `dynamodb:Query` on `…/index/latest` only. |
| Events waiting for Analysis (03, tiers in 10) | Query GSI `pending` one partition at a time — `A`, `B`, legacy `EVENT`, then `C` — newest first (sort key `publishedAt`), until the batch limit is filled. At most 4 small queries per run. Ingest role only. |
| Backlog for the "Analysis stalled" alarm | `Select = COUNT` on each of the 4 `pending` partitions, all pages. |
| Near-duplicate candidates (10) | Query GSI `latest` (`kind = EVENT`, `publishedAt >= now − 48 h`), filter `attribute_exists(analysis)`, projection `title, analysis`, all pages. Once per run, only when something is pending; ~400 items ≈ 40 RCU, within the index burst. Ingest role. |
| Save an Analysis (03) | `UpdateItem`: `SET analysis REMOVE pending`, condition `attribute_exists(id)`. One write takes the Event off the queue. |

### Capacity — 0 PLN

DynamoDB is always free only in **provisioned** mode: 25 RCU + 25 WCU and 25 GB per account and Region. On-demand has no free request allowance.

| | RCU | WCU |
|---|---|---|
| Table | 5 | 5 |
| GSI `latest` | 5 | 5 |
| GSI `pending` | 5 | 5 |
| **Total** (limit 25 / 25) | 15 | 15 |

Load: up to ~100 puts per hourly run (19 Sources, but items older than 48 h are skipped before the put; one WCU each, item < 1 KB, a failed condition still consumes it); a few reads per page view. ~400 B per item → well under 1 GB per year. A single `kind` partition on the GSI is fine at this volume.

No auto scaling (it creates CloudWatch alarms). Retention / TTL is out of scope for 02.


## `threads` table (DynamoDB, slice 09 →)

Single-table design for everything that is not a raw Event (ADR 0009). Created in slice 09 as `foresight-<environment>-threads`: partition key `pk`, sort key `sk`, **no indexes**, provisioned 5/5, TTL on `expiresAt`.

| `pk` | `sk` | Item | Slice |
|---|---|---|---|
| `BUDGET#<UTC day>` | `MODEL#<lane>` | Daily token counter: `tokens` (N), `expiresAt` (epoch seconds, day + 30 days) | 09 |
| `THREADS` | `<thread id>` | The Thread itself (`Thread` in `packages/shared/src/thread.ts`): name, status (`proposed` / `active` / `rejected` / `merged`), `lastEventAt`, counters, Regions, lead scenario and Moves of the latest report | 10 |
| `THREAD#<id>` | `EVENT#<publishedAt>#<event id>` | Timeline entry — a short copy of the dispatch with the Source tier and `linkedAt` (`TimelineEntry`) | 10 |
| `THREAD#<id>` | `REPORT#<createdAt>` | Situation report version (`SituationReport`); every version is kept | 10 |

The Thread lives only in the `THREADS` partition (no separate `META` item), so the list of Threads — what both the dispatch prompt and the Briefing need — is one Query. Thread ids are 8 hex characters: short in the prompt, checked by a regex at every route.

Budget lanes (slice 10): dispatches and reports both run on `gpt-oss-120b`, so the counter key is a lane — `openai/gpt-oss-120b` (dispatches, 110K/day) and `openai/gpt-oss-120b#reports` (70K/day).

### Access patterns

| Pattern | How | Who |
|---|---|---|
| Tokens spent today in a lane | `GetItem` on `BUDGET#<day>` / `MODEL#<lane>`; missing item = 0. Read once per run. | worker |
| Count a call | `UpdateItem`: `ADD tokens :n SET expiresAt = if_not_exists(expiresAt, :ttl)` — atomic | worker |
| All Threads | `Query pk = THREADS` (all pages). Once per run for the dispatch prompt (active + open proposals, max 30) and once for due reports; once per Briefing view | worker, web |
| Open a New situation | `PutItem` on `THREADS` with `attribute_not_exists(pk)` | worker |
| Put a dispatch on a timeline | `PutItem` of the entry, then `UpdateItem` of the Thread: `SET lastEventAt, newWeight, regions ADD eventCount, newEvents` — never `status`, so an owner decision made during a run is not overwritten | worker |
| Timeline, newest first | `Query pk = THREAD#<id> AND begins_with(sk, EVENT#)`, `ScanIndexForward = false`, `Limit 100` | worker, web |
| Latest report | the same with `REPORT#` and `Limit 1` | worker, web |
| Save a report | `PutItem` of `REPORT#<createdAt>`, then `UpdateItem` of the Thread: `SET reportedAt, lead, moves, newEvents = 0, newWeight = 0` | worker |
| Owner decision | `GetItem` of the proposal, then `UpdateItem` with condition `status = proposed`; a merge closes the proposal first, then copies its entries (`PutItem` each) and adds them to the target's counters | web (owner route) |

The worker role may `GetItem` / `PutItem` / `UpdateItem` / `Query` items whose partition key is `BUDGET#*`, `THREADS` or `THREAD#*`; the web role the same actions on `THREADS` and `THREAD#*` only (`dynamodb:LeadingKeys`). Neither may delete or scan.

Load: ~20 dispatches an hour, of which maybe half attach — ~20 writes per run, and up to 3 reports (2 writes each). Within 5 WCU thanks to burst capacity; a Thread item is < 2 KB, a report < 8 KB.

### Capacity — all tables

| | RCU | WCU |
|---|---|---|
| `events` + 2 indexes | 15 | 15 |
| `threads` | 5 | 5 |
| **Total** (limit 25 / 25) | 20 | 20 |
