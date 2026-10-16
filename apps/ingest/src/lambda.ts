// Entry point of the `ingest` Lambda (Terraform: handler = "index.handler"), run by EventBridge Scheduler.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createGroqAnalyzer } from "./analysis/groq.js";
import { DynamoAnalysisQueue } from "./dynamo-analysis.js";
import { DynamoEventStore } from "./dynamo-store.js";
import { fetchFeed } from "./feed.js";
import { createHandler } from "./handler.js";
import { DynamoResolutionStore } from "./resolve/dynamo.js";
import { runResolve } from "./resolve/run.js";
import { createTiingoPrices } from "./resolve/tiingo.js";
import { SOURCES } from "./sources.js";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is not set");
const groqKeyParameter = process.env.GROQ_KEY_PARAMETER;
const thesesTableName = process.env.THESES_TABLE_NAME;
const tiingoKeyParameter = process.env.TIINGO_KEY_PARAMETER;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const ssm = new SSMClient();

// API keys (Groq, Tiingo) live only in SSM (SecureString, created by hand — never in Terraform
// state) and are read once per cold start, only when they are needed.
const keys = new Map<string, Promise<string>>();
const readKey = (name: string) => {
  let key = keys.get(name);
  if (!key) {
    key = ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true })).then((res) => {
      const value = res.Parameter?.Value;
      if (!value) throw new Error(`SSM parameter ${name} is empty`);
      return value;
    });
    keys.set(name, key);
  }
  return key;
};

export const handler = createHandler({
  sources: SOURCES,
  fetchFeed: (url) => fetchFeed(url),
  store: new DynamoEventStore(ddb, tableName),
  log: console.log,
  ...(groqKeyParameter && {
    analysis: {
      queue: new DynamoAnalysisQueue(ddb, tableName),
      analyzer: async () => createGroqAnalyzer({ apiKey: await readKey(groqKeyParameter) }),
    },
  }),
  ...(thesesTableName &&
    tiingoKeyParameter && {
      resolve: async () =>
        runResolve({
          store: new DynamoResolutionStore(ddb, thesesTableName),
          prices: createTiingoPrices({ apiKey: await readKey(tiingoKeyParameter) }),
          now: () => new Date(),
        }),
    }),
});
