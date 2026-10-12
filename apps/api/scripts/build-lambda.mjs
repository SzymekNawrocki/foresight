// Artefakt Lambdy `web`: dist/foresight-web.zip = index.mjs (bundle API) + public/ (apps/web/dist).
// Powtarzalny: stała data plików i stała kolejność wpisów → ten sam kod daje ten sam ZIP.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { zipSync } from "fflate";

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const webDist = join(apiDir, "..", "web", "dist");
const outDir = join(apiDir, "dist");
const zipPath = join(outDir, "foresight-web.zip");
const fixedDate = new Date("2026-01-01T00:00:00Z");

if (!statSync(join(webDist, "index.html"), { throwIfNoEntry: false })) {
  throw new Error(`Brak ${webDist}/index.html — najpierw zbuduj frontend (pnpm build:lambda w korzeniu).`);
}

const bundle = await build({
  entryPoints: [join(apiDir, "src", "lambda.ts")],
  bundle: true,
  // Some AWS SDK dependencies still call require(); give the ESM bundle one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  platform: "node",
  format: "esm",
  target: "node24",
  write: false,
  outfile: "index.mjs",
  legalComments: "none",
});

const files = { "index.mjs": [bundle.outputFiles[0].contents, { mtime: fixedDate }] };

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(full) : [full];
    });
}

for (const file of listFiles(webDist)) {
  const name = ["public", ...relative(webDist, file).split(sep)].join("/");
  files[name] = [readFileSync(file), { mtime: fixedDate }];
}

mkdirSync(outDir, { recursive: true });
writeFileSync(zipPath, zipSync(files, { level: 9 }));

const kib = (statSync(zipPath).size / 1024).toFixed(1);
console.log(`${relative(process.cwd(), zipPath)} — ${Object.keys(files).length} plików, ${kib} KiB`);
