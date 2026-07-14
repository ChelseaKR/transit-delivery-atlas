import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const relativePath = path === "/" ? "index.html" : `${path.replace(/^\//, "")}/index.html`;
  const html = await readFile(new URL(`../out/${relativePath}`, import.meta.url), "utf8");
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function assertTextOrder(html, labels) {
  const positions = labels.map((label) => html.indexOf(label));
  for (let index = 0; index < positions.length; index += 1) {
    assert.notEqual(positions[index], -1, `Missing ordered label: ${labels[index]}`);
    if (index > 0) {
      assert.ok(
        positions[index - 1] < positions[index],
        `${labels[index - 1]} must render before ${labels[index]}`,
      );
    }
  }
}

test("statically renders the complete atlas home page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html[^>]*lang="en"/i);
  assert.match(html, /<title>Transit Delivery Atlas<\/title>/i);
  assert.match(html, /href="#main-content"[^>]*>\s*Skip to main content/i);
  assert.match(html, /<main[^>]*id="main-content"/i);
  assert.match(html, /Independent analysis/);
  assert.match(html, /Twenty-one directive units/);
  assert.match(html, /Showing[\s\S]{0,80}21[\s\S]{0,80}of[\s\S]{0,80}21/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /href="\/corrections\/?"[^>]*>Corrections and review/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\/choose"/,
  );
  assert.match(html, /property="og:image"[^>]+https:\/\/transit\.chelseakr\.com\/og\.png/i);
  assert.match(html, /rel="canonical"[^>]+href="https:\/\/transit\.chelseakr\.com\/"/i);
  assert.match(html, /aria-label="Inspect source, evidence, and analysis for directive 1\(a\):/i);
  assert.match(html, /Evidence[\s\S]{0,100}Dated public records/);
  assert.match(html, /No explicit completion deadline in the signed order/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("renders source, safe empty evidence, and analysis on an unlinked directive", async () => {
  const response = await render("/directives/n-7-26-1e");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Transit infrastructure design and permitting materials/);
  assert.match(html, /What the signed order says/);
  assert.match(html, /What is documented publicly/);
  assert.match(html, /Analytical crosswalk/);
  assert.match(html, /Source record/);
  assert.match(html, /Reviewed public evidence/);
  assert.match(html, /Independent analysis/);
  // A print affordance is rendered on the directive record page; the button is
  // hidden by the existing @media print rules so the printout stays clean.
  assert.match(html, /class="print-record-button"/);
  assert.match(html, /Print this record/);
  assert.match(html, /Oct 24, 2026/);
  assert.match(html, /Jun 26, 2027/);
  assert.match(html, /blockquote/i);
  assert.match(html, /rel="canonical"[^>]+\/directives\/n-7-26-1e/i);
  assert.match(
    html,
    /No reviewed public artifacts are included for this directive in the current Atlas release\. This is a statement about Atlas coverage, not evidence that no implementation activity or public record exists\./,
  );
  assert.doesNotMatch(html, /Transit Executive Order N-7-26 Resource Material/);
  assertTextOrder(html, [
    "What the signed order says",
    "What is documented publicly",
    "Analytical crosswalk",
  ]);
});

test("renders Order 5 evidence between the signed source and independent analysis", async () => {
  const response = await render("/directives/n-7-26-5");
  assert.equal(response.status, 200);
  const html = await response.text();

  assertTextOrder(html, [
    "What the signed order says",
    "What is documented publicly",
    "Analytical crosswalk",
  ]);
  assert.match(html, /Reviewed public evidence/);
  assert.match(html, /Transit Executive Order N-7-26 Resource Material/);
  assert.match(html, /Jul 15, 2026/);
  assert.match(html, /Scheduled event date/);
  assert.match(html, /Pursuant to Executive Order N-7-26 \(Order #5\)/);
  assert.match(html, /Page 1: Reference Instructions and SCCP Part IV, Section 17\.2\.2/);
  assert.match(html, /Page 2: Reference Instructions; LPP-C Part II, Section 6B/);
  assert.match(html, /Open public record:/);
  assert.match(
    html,
    /href="https:\/\/catc\.ca\.gov\/-\/media\/ctc-media\/documents\/programs\/senate-bill-1\/july-15-sccp-and-lpp-c-workshop-transit-eo-resource-material-002-a11y\.pdf"/,
  );
  assert.match(
    html,
    /Inclusion documents a source relationship; it does not establish implementation status, completion, compliance, or activity beyond the cited record\./,
  );
});

test("renders the selective public-evidence index", async () => {
  const response = await render("/evidence");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<main[^>]*id="main-content"/i);
  assert.match(html, /Public artifacts, linked with limits\./);
  assert.match(html, /Transit Executive Order N-7-26 Resource Material/);
  assert.match(html, /California Transportation Commission/);
  assert.match(html, /Jul 15, 2026/);
  assert.match(html, /Scheduled event date/);
  assert.match(html, /n-7-26-5/);
  assert.match(html, /rel="canonical"[^>]+\/evidence/i);
  assert.match(
    html,
    /href="https:\/\/chelseakr\.com\/writing\/signed-transit-order-start"/,
  );
  assert.match(
    html,
    /href="https:\/\/catc\.ca\.gov\/-\/media\/ctc-media\/documents\/programs\/senate-bill-1\/july-15-sccp-and-lpp-c-workshop-transit-eo-resource-material-002-a11y\.pdf"/,
  );
  assert.match(
    html,
    /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\?template=01-content-correction\.yml"/,
  );
});

test("renders source relationships before separately labeled analytical cross-references", async () => {
  const response = await render("/handoffs");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<main[^>]*id="main-content"/i);
  assert.match(html, /Trace the delivery relationships\./);
  assert.match(html, /Potential handoff map/);
  assert.match(html, /A relationship is not a status\./);
  assert.match(html, /Bodies and groups named in the order/);
  assert.match(html, /Inferred delivery dependencies/);
  assertTextOrder(html, [
    "Bodies and groups named in the order",
    "Inferred delivery dependencies",
  ]);
  assert.match(html, /Explicit source-role links[\s\S]{0,100}>50</);
  assert.match(html, /Analytical cross-references[\s\S]{0,100}>27</);
  assert.match(html, /Showing[\s\S]{0,80}23[\s\S]{0,80}of[\s\S]{0,80}23/);
  assert.match(
    html,
    /Showing[\s\S]{0,100}21[\s\S]{0,100}statements[\s\S]{0,100}27[\s\S]{0,100}of[\s\S]{0,100}27[\s\S]{0,100}cross-references/,
  );
  assert.equal((html.match(/aria-live="polite"/g) ?? []).length, 2);
  assert.match(html, /Explicit lead/);
  assert.match(html, /Explicit collaborator/);
  assert.match(html, /Other named party/);
  assert.match(html, /No cross-directive link is recorded for this dependency/);
  assert.match(
    html,
    /href="\/directives\/n-7-26-1c\/"[^>]*>Section 5307 direct-recipient option<\/a>/,
  );
  assert.match(html, /rel="canonical"[^>]+\/handoffs/i);
  assert.doesNotMatch(html, /critical path|percent complete|traffic light/i);
});

test("renders the cited TDA and NTD feasibility boundary", async () => {
  const response = await render("/research/tda-ntd");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Four fields\. One honest automation boundary/);
  assert.match(html, /Automate preparation, not accountability/);
  assert.match(html, /Passenger boardings/);
  assert.match(html, /Vehicle revenue miles/);
  assert.match(html, /Vehicle revenue hours/);
  assert.match(html, /Operating expense/);
  assert.match(html, /Conditionally automatable/);
  assert.match(html, /Assistable · method review/);
  assert.match(html, /Reconciliation required/);
  assert.match(html, /California rural Section 5311 subrecipient/);
  assert.match(html, /Unattended filings supported[\s\S]{0,120}>0</);
  assert.match(html, /href="\/data\/tda-ntd-feasibility\.json"/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\?template=02-review-feedback\.yml"/,
  );
  assert.match(html, /rel="canonical"[^>]+\/research\/tda-ntd/i);
});

test("renders the public correction and review funnel", async () => {
  const response = await render("/corrections");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Challenge the record, with a source\./);
  assert.match(html, /Correct content or data/);
  assert.match(html, /Share review feedback/);
  assert.match(html, /public GitHub issue/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\?template=01-content-correction\.yml"/,
  );
  assert.match(
    html,
    /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\?template=02-review-feedback\.yml"/,
  );
  assert.match(html, /rel="canonical"[^>]+\/corrections/i);
});

test("renders methodology, data, and accessibility pages", async () => {
  const paths = [
    ["/methodology", /Keep source, evidence, and interpretation apart\./],
    ["/data", /Inspect, reuse, and challenge the crosswalk/],
    ["/accessibility", /Accessibility is a release requirement/],
  ];

  for (const [path, pattern] of paths) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, pattern);
    assert.match(html, /<main[^>]*id="main-content"/i);
    if (path === "/data") {
      assert.match(html, /href="\/data\/directive-organizations\.csv"/);
      assert.match(html, /href="\/data\/directive-relationships\.csv"/);
      assert.match(html, /record_directive_id/);
      assert.match(
        html,
        /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\?template=01-content-correction\.yml"/,
      );
    }
  }
});
