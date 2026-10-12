import { type IngestInput, runIngest } from "./ingest.js";

export interface HandlerDeps extends Omit<IngestInput, "now"> {
  log: (line: string) => void;
}

// Failures stay in the report (and the log); throwing would only make Lambda retry the feeds.
export function createHandler({ log, ...deps }: HandlerDeps) {
  return async () => {
    const report = await runIngest({ ...deps, now: () => new Date() });
    log(JSON.stringify({ msg: "ingest finished", report }));
    return report;
  };
}
