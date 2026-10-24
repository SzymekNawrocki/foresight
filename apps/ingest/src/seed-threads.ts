// One-off owner command (#65, step 5): `pnpm --filter @foresight/ingest seed-threads [--apply]`.
// Without --apply it only prints the plan. Uses the owner's AWS credentials from the environment
// (in Git Bash: eval "$(aws configure export-credentials --format env)").
import { randomBytes } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoThreadStore } from "./threads/dynamo-threads.js";
import { applySeed, planSeed, SEED_THREADS } from "./threads/seed.js";

const tableName = process.env.THREADS_TABLE_NAME ?? "foresight-prod-threads";
const apply = process.argv.includes("--apply");

const store = new DynamoThreadStore(DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" })), tableName);
const threads = await store.list();
const plan = planSeed(threads, SEED_THREADS, new Date(), () => randomBytes(4).toString("hex"));
const nameOf = (id: string) => threads.find((t) => t.id === id)?.name ?? id;

console.log(`Table ${tableName}: ${threads.length} Threads`);
for (const t of plan.create) console.log(`  create  ${t.id}  ${t.name}`);
for (const r of plan.rename) console.log(`  rename  ${r.id}  ${nameOf(r.id)} → ${r.name}`);
for (const id of plan.close) console.log(`  close   ${id}  ${nameOf(id)}`);
console.log(`  reject  ${plan.reject.length} open proposals`);

if (!apply) {
  console.log("Dry run. Run again with --apply to write.");
} else {
  console.log(JSON.stringify(await applySeed(store, plan)));
}
