// Entry point of the `ingest` Lambda (Terraform: handler = "index.handler"), run by EventBridge Scheduler.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createGroqAnalyzer } from "./analysis/groq.js";
import { DynamoAnalysisQueue } from "./dynamo-analysis.js";
import { DynamoEventStore } from "./dynamo-store.js";
import { fetchFeed } from "./feed.js";
import { createHandler } from "./handler.js";
import { SOURCES } from "./sources.js";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is not set");
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

export const handler = createHandler({
  sources: SOURCES,
  fetchFeed: (url) => fetchFeed(url),
  store: new DynamoEventStore(ddb, tableName),
  log: console.log,
  ...(groqKeyParameter && {
    analysis: {
      queue: new DynamoAnalysisQueue(ddb, tableName),
      analyzer: async () => createGroqAnalyzer({ apiKey: await readGroqKey(groqKeyParameter) }),
    },
  }),
});
