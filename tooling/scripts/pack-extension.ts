import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..");
const appDir = path.join(repoRoot, "apps", "extension");
const exportDir = path.join(appDir, "out");
const distRoot = path.join(repoRoot, "dist");
const distDir = path.join(distRoot, "extension");
const zipPath = path.join(distRoot, "extension.zip");
const publicDir = path.join(appDir, "public");

function run(command: string, cwd = repoRoot) {
  execSync(command, { stdio: "inherit", cwd });
}

async function buildServiceWorker(outputDir: string) {
  await build({
    entryPoints: [path.join(publicDir, "service-worker.ts")],
    outfile: path.join(outputDir, "service-worker.js"),
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
    sourcemap: false,
    minify: true,
  });
}

async function main() {
  run("pnpm --filter @bookmarket/shared-kernel build");
  // Next.js 16+: `next export` is removed. `output: 'export'` generates `out/` via `next build`.
  run("pnpm --filter ./apps/extension build");

  if (!existsSync(exportDir)) {
    throw new Error(`Export directory not found: ${exportDir}`);
  }

  if (existsSync(distRoot)) {
    rmSync(distRoot, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  cpSync(exportDir, distDir, { recursive: true, dereference: true });
  await buildServiceWorker(distDir);

  // Remove the TS source to avoid shipping it.
  const tsServiceWorker = path.join(distDir, "service-worker.ts");
  if (existsSync(tsServiceWorker)) {
    rmSync(tsServiceWorker, { force: true });
  }

  // Create a zip with manifest at archive root (Chrome Web Store / sideload friendly).
  run(`zip -r -q "${zipPath}" .`, distDir);

  console.log(`✅ Extension bundle ready at ${distDir}`);
  console.log(`✅ Zip ready at ${zipPath}`);
}

main().catch((error) => {
  console.error("Failed to pack extension", error);
  process.exit(1);
});
