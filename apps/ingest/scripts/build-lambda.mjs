// Artifact of the `ingest` Lambda: dist/foresight-ingest.zip = index.mjs (bundle, AWS SDK included).
// Reproducible: fixed file date, single entry → the same code gives the same ZIP.
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { zipSync } from "fflate";

const ingestDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(ingestDir, "dist");
const zipPath = join(outDir, "foresight-ingest.zip");

const bundle = await build({
  entryPoints: [join(ingestDir, "src", "lambda.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  write: false,
  outfile: "index.mjs",
  legalComments: "none",
  // Some AWS SDK dependencies still call require(); give the ESM bundle one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

mkdirSync(outDir, { recursive: true });
writeFileSync(
  zipPath,
  zipSync({ "index.mjs": [bundle.outputFiles[0].contents, { mtime: new Date("2026-01-01T00:00:00Z") }] }, { level: 9 }),
);

console.log(`${relative(process.cwd(), zipPath)} — ${(statSync(zipPath).size / 1024).toFixed(1)} KiB`);
