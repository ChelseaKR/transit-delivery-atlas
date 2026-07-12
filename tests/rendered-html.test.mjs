import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(path, "http://localhost/"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete atlas home page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="en"/i);
  assert.match(html, /<title>Transit Delivery Atlas<\/title>/i);
  assert.match(html, /href="#main-content"[^>]*>\s*Skip to main content/i);
  assert.match(html, /<main[^>]*id="main-content"/i);
  assert.match(html, /Independent analysis/);
  assert.match(html, /Twenty-one directive units/);
  assert.match(html, /Showing[\s\S]{0,80}21[\s\S]{0,80}of[\s\S]{0,80}21/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /property="og:image"[^>]+og\.png/i);
  assert.match(html, /aria-label="Inspect source and analysis for directive 1\(a\):/i);
  assert.match(html, /No explicit completion deadline in the signed order/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("renders source and analytical layers on a directive permalink", async () => {
  const response = await render("/directives/n-7-26-1e");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Transit infrastructure design and permitting materials/);
  assert.match(html, /What the signed order says/);
  assert.match(html, /Analytical crosswalk/);
  assert.match(html, /Source record/);
  assert.match(html, /Independent analysis/);
  assert.match(html, /Oct 24, 2026/);
  assert.match(html, /Jun 26, 2027/);
  assert.match(html, /blockquote/i);
});

test("renders methodology, data, and accessibility pages", async () => {
  const paths = [
    ["/methodology", /Keep the source and the interpretation apart/],
    ["/data", /Inspect, reuse, and challenge the crosswalk/],
    ["/accessibility", /Accessibility is a release requirement/],
  ];

  for (const [path, pattern] of paths) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, pattern);
    assert.match(html, /<main[^>]*id="main-content"/i);
  }
});
