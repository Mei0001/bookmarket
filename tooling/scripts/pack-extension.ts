import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const repoRoot = path.resolve(__dirname, "..", "..");
const appDir = path.join(repoRoot, "apps", "extension");
const exportDir = path.join(appDir, "out");
const distDir = path.join(repoRoot, "dist", "extension");
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
    minify: true
  });
}

async function main() {
  run("pnpm --filter ./apps/extension build");
  run("pnpm --filter ./apps/extension export");

  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  cpSync(exportDir, distDir, { recursive: true, dereference: true });
  await buildServiceWorker(distDir);

  console.log(`✅ Extension bundle ready at ${distDir}`);
}

main().catch((error) => {
  console.error("Failed to pack extension", error);
  process.exit(1);
});

