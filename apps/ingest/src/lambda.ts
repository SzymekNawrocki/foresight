// Entry point of the `ingest` Lambda — the hourly worker (Terraform: handler = "index.handler"),
// run by EventBridge Scheduler.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createPendingAnalysis } from "./analysis/pending.js";
import { createTokenBudget, DAILY_TOKEN_LIMITS, REPORT_LANE } from "./budget/budget.js";
import { DynamoBudgetStore } from "./budget/dynamo-budget.js";
import { DynamoAnalysisQueue } from "./dynamo-analysis.js";
import { DynamoEventStore } from "./dynamo-store.js";
import { fetchFeed } from "./feed.js";
import { createHandler } from "./handler.js";
import { createGroqLlm } from "./llm/groq.js";
import { createSituationReports } from "./reports/refresh.js";
import { SOURCES } from "./sources.js";
import { DynamoThreadStore } from "./threads/dynamo-threads.js";
import { createThreadLinks } from "./threads/links.js";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is not set");
const threadsTableName = process.env.THREADS_TABLE_NAME;
const groqKeyParameter = process.env.GROQ_KEY_PARAMETER;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const ssm = new SSMClient();

// The Groq key lives only in SSM (SecureString, created by hand — never in Terraform state)
// and is read once per cold start, only when there is something to analyze.
let groqKey: Promise<string> | undefined;
const readGroqKey = (name: string) =>
  (groqKey ??= ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true })).then((res) => {
    const value = res.Parameter?.Value;
    if (!value) throw new Error(`SSM parameter ${name} is empty`);
    return value;
  }));

const budgetStore = threadsTableName ? new DynamoBudgetStore(ddb, threadsTableName) : undefined;
const threadStore = threadsTableName ? new DynamoThreadStore(ddb, threadsTableName) : undefined;
const tiers = new Map(SOURCES.map((s) => [s.id, s.tier]));
const links = threadStore && createThreadLinks({ store: threadStore, tierOf: (source) => tiers.get(source) ?? "C" });
const llm = async () => createGroqLlm({ apiKey: await readGroqKey(groqKeyParameter as string) });

export const handler = createHandler({
  sources: SOURCES,
  fetchFeed: (url) => fetchFeed(url),
  store: new DynamoEventStore(ddb, tableName),
  log: console.log,
  ...(groqKeyParameter &&
    budgetStore &&
    threadStore &&
    links && {
      analysis: {
        pending: createPendingAnalysis({
          queue: new DynamoAnalysisQueue(ddb, tableName),
          llm,
          threads: links.active,
          link: links.link,
        }),
        reports: createSituationReports({ store: threadStore, llm, lane: REPORT_LANE }),
        budget: () => createTokenBudget({ store: budgetStore, limits: DAILY_TOKEN_LIMITS }),
      },
    }),
});
