#!/usr/bin/env node
// §18 bundle budget: assert that the gzip total of dist/assets/*.js is at most
// 800 KB. Runs after `vite build` in CI as a fast guard alongside Lighthouse.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const BUDGET_BYTES = 800 * 1024;
const distAssets = new URL("../dist/assets/", import.meta.url).pathname;

let total = 0;
const lines = [];
for (const name of readdirSync(distAssets)) {
  if (!name.endsWith(".js")) continue;
  const path = join(distAssets, name);
  if (!statSync(path).isFile()) continue;
  const raw = readFileSync(path);
  const gz = gzipSync(raw).length;
  total += gz;
  lines.push(`  ${name.padEnd(40)} ${(gz / 1024).toFixed(1)} KB gzip`);
}

const totalKb = (total / 1024).toFixed(1);
const budgetKb = (BUDGET_BYTES / 1024).toFixed(0);
console.log("Bundle budget report (§18: ≤ 800 KB gzip):");
for (const l of lines) console.log(l);
console.log(`  ----`);
console.log(`  total ${totalKb} KB gzip   /   budget ${budgetKb} KB`);

if (total > BUDGET_BYTES) {
  console.error(`\n❌  Budget exceeded by ${((total - BUDGET_BYTES) / 1024).toFixed(1)} KB.`);
  process.exit(1);
}
console.log("\n✅  Within budget.");
