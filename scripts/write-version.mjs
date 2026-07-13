import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

const sha =
  process.env.BUILD_SHA?.trim() ||
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

await writeFile(
  new URL("../public/version.json", import.meta.url),
  `${JSON.stringify({ sha, builtAt: new Date().toISOString() }, null, 2)}\n`,
);
