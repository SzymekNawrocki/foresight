# Data model

## `events` table (DynamoDB, slice 02)

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

Schema: `Event` in `packages/shared/src/event.ts`.

### Access patterns

| Pattern | How |
|---|---|
| Store an Event once | `PutItem` with `attribute_not_exists(id)`; a failed condition = duplicate |
| Latest N Events (02c) | Query GSI `latest` (`kind = EVENT`, sort key `publishedAt`), `ScanIndexForward = false`, `Limit = N`. The web role may `dynamodb:Query` on `…/index/latest` only. |

### Capacity — 0 PLN

DynamoDB is always free only in **provisioned** mode: 25 RCU + 25 WCU and 25 GB per account and Region. On-demand has no free request allowance.

| | RCU | WCU |
|---|---|---|
| Table | 5 | 5 |
| GSI `latest` | 5 | 5 |
| **Total** (limit 25 / 25) | 10 | 10 |

Load: ~100 puts per hourly run (one WCU each, item < 1 KB, a failed condition still consumes it); a few reads per page view. ~400 B per item → well under 1 GB per year. A single `kind` partition on the GSI is fine at this volume.

No auto scaling (it creates CloudWatch alarms). Retention / TTL is out of scope for 02.
