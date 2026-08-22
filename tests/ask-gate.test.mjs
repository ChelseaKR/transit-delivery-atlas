import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { resolveAskEndpoint } from "../lib/ask-client.ts";

/**
 * The panel is an affordance, and an affordance that cannot be fulfilled is a
 * broken promise: a reader told they may ask a question has already been told
 * something untrue by the time an error string explains that no service
 * exists. So the panel is gated at build time on NEXT_PUBLIC_ASK_ENDPOINT, and
 * both directions of that gate are pinned here — absent when unset against the
 * ordinary build, present when set against a real second build.
 */

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

test("the gate treats unset, empty, and whitespace-only configuration as no service", () => {
  assert.equal(resolveAskEndpoint(undefined), null);
  assert.equal(resolveAskEndpoint(null), null);
  assert.equal(resolveAskEndpoint(""), null);
  assert.equal(resolveAskEndpoint("   "), null);
  assert.equal(resolveAskEndpoint("\t\n"), null);
  assert.equal(resolveAskEndpoint("/api/ask"), "/api/ask");
  assert.equal(resolveAskEndpoint("  /api/ask  "), "/api/ask");
});

test("the ordinary build configures no service and renders no panel on any directive page", async () => {
  const directives = JSON.parse(await readFile(new URL("../data/directives.json", import.meta.url), "utf8"));
  assert.ok(directives.directives.length >= 21, "every directive page is checked, not just one");
  for (const directive of directives.directives) {
    const html = await readFile(new URL(`../out/directives/${directive.id}/index.html`, import.meta.url), "utf8");
    assert.doesNotMatch(html, /data-ask-directive/, `${directive.id} renders a panel without a configured service`);
    assert.doesNotMatch(html, /Ask about this directive/, `${directive.id} offers to answer questions with no service`);
    assert.doesNotMatch(html, /<textarea/i, `${directive.id} invites input with no service`);
  }
});

test("a build with a configured service renders the panel, labelled and opt-in", async (t) => {
  t.diagnostic("builds the site a second time into an isolated export directory");
  const exportDir = "out-ask-gate";
  const target = new URL(`../${exportDir}/directives/n-7-26-1a/index.html`, import.meta.url);
  try {
    await run("npx", ["next", "build"], {
      cwd: projectRoot,
      env: { ...process.env, NEXT_PUBLIC_ASK_ENDPOINT: "/api/ask", NEXT_EXPORT_DIR: exportDir },
      maxBuffer: 32 * 1024 * 1024,
    });
    const html = await readFile(target, "utf8");
    assert.match(html, /data-ask-directive="n-7-26-1a"/);
    assert.match(html, /Ask about this directive/);
    assert.match(html, /Optional · AI · off until you use it/);
    assert.match(html, /refuses compliance and status questions/);
    assert.match(html, /Nothing is sent anywhere until you submit a question\./);
    // Even configured, the panel is inert until the reader opens it: a button,
    // not a form, and no request has been made to render it.
    assert.doesNotMatch(html, /<textarea/i);
    // Configuring the service still introduces no off-origin host: the
    // endpoint is a same-origin relative path, so it cannot appear as one.
    for (const [absoluteUrl] of html.matchAll(/https?:\/\/[^\s"'<>)\\]+/gi)) {
      let parsed;
      try {
        parsed = new URL(absoluteUrl);
      } catch {
        continue;
      }
      assert.notEqual(parsed.hostname.toLowerCase(), "api.anthropic.com");
      assert.doesNotMatch(parsed.hostname.toLowerCase(), /amazonaws\.com$/);
    }
  } finally {
    await rm(new URL(`../${exportDir}/`, import.meta.url), { recursive: true, force: true });
  }
});
