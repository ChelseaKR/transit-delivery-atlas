import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { provenanceSentence, timingDetail } from "../lib/register-labels.ts";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

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
  assert.match(html, /Directive register/);
  assert.match(html, /Directive records[\s\S]{0,100}>21</);
  assert.match(html, /Evidence records/);
  assert.match(html, /Showing[\s\S]{0,80}21[\s\S]{0,80}of[\s\S]{0,80}21/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /href="\/corrections\/?"[^>]*>Corrections and review/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\/choose"/,
  );
  assert.match(html, /property="og:image"[^>]+https:\/\/transit\.chelseakr\.com\/og\.png/i);
  assert.match(html, /rel="canonical"[^>]+href="https:\/\/transit\.chelseakr\.com\/"/i);
  assert.match(html, /aria-label="Inspect directive 1\(a\):/i);
  assert.match(html, /Record layer key/);
  assert.match(html, /Source[\s\S]{0,100}Evidence[\s\S]{0,100}Analysis/);
  assert.match(html, /href="\/watchlist\/?"[^>]*>Watchlist/);
  assert.match(html, /No explicit completion deadline in the signed order/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("no register row publishes a bare evidence count or an unlabelled layer", async () => {
  const html = (await (await render()).text()).replaceAll("<!-- -->", "");
  const [directiveData, evidenceData] = await Promise.all([
    readJson("data/directives.json"),
    readJson("data/evidence.json"),
  ]);

  const evidenceCounts = new Map(
    directiveData.directives.map(({ id }) => [id, 0]),
  );
  for (const record of evidenceData.evidence) {
    for (const { directiveId } of record.directiveLinks) {
      evidenceCounts.set(directiveId, (evidenceCounts.get(directiveId) ?? 0) + 1);
    }
  }

  // Absence is published as absence. `E 0` reads as a finding about the
  // directive; it is a statement about Atlas coverage.
  assert.doesNotMatch(html, />\s*E 0\s*</, "a bare zero must not render");
  assert.match(html, /E —/);
  assert.match(
    html,
    /No reviewed evidence linked in this release\. This is a statement about Atlas coverage, not evidence that no implementation activity or public record exists\./,
  );

  const labelled = [...html.matchAll(/directive-row__provenance/g)].length;
  assert.equal(
    labelled,
    directiveData.directives.length,
    "every rendered row must carry a provenance block",
  );

  for (const directive of directiveData.directives) {
    const sentence = provenanceSentence({
      label: directive.label,
      evidenceCount: evidenceCounts.get(directive.id) ?? 0,
    });
    assert.ok(
      html.includes(sentence),
      `directive ${directive.label} must publish its own provenance sentence`,
    );
  }
});

test("the register labels its calculated dates as calculated", async () => {
  const html = (await (await render()).text()).replaceAll("<!-- -->", "");
  const directiveData = await readJson("data/directives.json");

  assert.doesNotMatch(
    html,
    /aria-label="Timing in the signed order"/,
    "a derived date must not sit under a label asserting it is source text",
  );
  assert.match(html, /aria-label="Planning dates calculated from the order"/);
  assert.match(html, /Timing \(calculated\)/);

  for (const directive of directiveData.directives) {
    for (const timing of directive.timing) {
      assert.ok(
        html.includes(timingDetail(timing, `Directive ${directive.label}`)),
        `directive ${directive.label} must publish the derivation of ${timing.derivedDate}`,
      );
    }
  }
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

  // The empty state says which of its two meanings applies: the listed sources
  // were checked and found nothing, or nobody has successfully looked yet.
  assert.match(html, /data-coverage-state="checked-none-found"/);
  assert.match(html, /Where the Atlas has looked/);
  assert.match(html, /no artifact citing the order was found there/);
  assert.match(html, /next planned check of the listed sources is \d{4}-\d{2}-\d{2}/);
  assert.match(html, /href="https:\/\/dot\.ca\.gov\/news-releases"/);
  assert.doesNotMatch(html, /data-coverage-state="not-yet-reviewed"/);
});

test("the AI panel is opt-in, labelled, and names no other origin", async () => {
  const html = await (await render("/directives/n-7-26-1a")).text();
  assert.match(html, /data-ask-directive="n-7-26-1a"/);
  assert.match(html, /Ask about this directive/);
  assert.match(html, /Optional · AI · off until you use it/);
  assert.match(html, /refuses compliance and status questions/);
  assert.match(html, /Nothing is sent anywhere until you submit a question\./);
  // Adding the panel introduced no origin at all. Every absolute URL in the
  // rendered page is parsed and its host compared exactly against the hosts
  // the record already linked, so a provider endpoint cannot hide behind a
  // lookalike name; the ask endpoint is a same-origin relative path baked in
  // at build time.
  const allowedHosts = new Set(["transit.chelseakr.com", "www.gov.ca.gov", "dot.ca.gov", "github.com"]);
  const hosts = new Set();
  for (const [absoluteUrl] of html.matchAll(/https?:\/\/[^\s"'<>)\\]+/gi)) {
    let parsed;
    try {
      parsed = new URL(absoluteUrl);
    } catch {
      continue;
    }
    hosts.add(parsed.hostname.toLowerCase());
  }
  assert.ok(hosts.size > 0, "the record does link absolute URLs, so the check is looking at something");
  for (const host of hosts) {
    assert.ok(allowedHosts.has(host), `the rendered page names an unexpected host: ${host}`);
  }
  // The panel renders before the reader acts as a static button, not a form.
  assert.doesNotMatch(html, /<textarea/i);
});

test("a directive whose dedicated source failed retrieval says so without a verdict", async () => {
  const html = await (await render("/directives/n-7-26-4")).text();
  assert.match(html, /data-coverage-state="checked-none-found"/);
  assert.match(html, /could not be retrieved at the last attempt, so that source is not yet reviewed/);
  assert.match(html, /Retrieval failed/);
  assert.doesNotMatch(html, /has not complied|not on track|behind schedule/i);
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
  assert.match(html, /2026 SB1 Program Guidelines Development Workshop/);
  assert.match(html, /Jul 15, 2026/);
  assert.match(html, /Scheduled event date/);
  assert.match(html, /Pursuant to Executive Order N-7-26 \(Order #5\)/);
  assert.match(html, /Page 1: Reference Instructions and SCCP Part IV, Section 17\.2\.2/);
  assert.match(html, /Page 2: Reference Instructions; LPP-C Part II, Section 6B/);
  assert.match(html, /Page 12: California Executive Order N-7-26 overview/);
  assert.match(html, /Open public record:/);
  assert.match(
    html,
    /href="https:\/\/catc\.ca\.gov\/-\/media\/ctc-media\/documents\/programs\/senate-bill-1\/july-15-sccp-and-lpp-c-workshop-transit-eo-resource-material-002-a11y\.pdf"/,
  );
  assert.match(
    html,
    /href="https:\/\/catc\.ca\.gov\/-\/media\/ctc-media\/documents\/programs\/senate-bill-1\/07-15-2026-2026-eluh-workshop-v-4-5-final-a11y\.pdf"/,
  );
  assert.match(
    html,
    /Inclusion documents a source relationship; it does not establish implementation status, completion, compliance, or activity beyond the cited record\./,
  );
  assertTextOrder(html, [
    "What the signed order says",
    "What is documented publicly",
    "Analytical crosswalk",
    "Related context under review",
  ]);
  assert.match(html, /North Hearing for the Proposed 2026 Solutions for Congested Corridors Program/);
  assert.match(html, /Context only · Not implementation evidence/);
});

test("renders the selective public-evidence index", async () => {
  const response = await render("/evidence");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<main[^>]*id="main-content"/i);
  assert.match(html, /Reviewed public evidence/);
  assert.match(html, /Transit Executive Order N-7-26 Resource Material/);
  assert.match(html, /2026 SB1 Program Guidelines Development Workshop/);
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
    /href="https:\/\/catc\.ca\.gov\/-\/media\/ctc-media\/documents\/programs\/senate-bill-1\/07-15-2026-2026-eluh-workshop-v-4-5-final-a11y\.pdf"/,
  );
  assert.match(
    html,
    /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\?template=01-content-correction\.yml"/,
  );
  assert.match(html, /href="\/watchlist\/?"[^>]*>context watchlist/);

  // The forward commitment (#59): source list, last-checked dates, next sweep.
  assert.match(html, /Sources checked, and when they are checked next/);
  assert.match(html, /Next planned sweep/);
  assert.match(html, /Review commitment:/);
  assert.match(html, /Public sources checked/);
  assert.match(html, /Sweep log/);
  assert.match(html, /Retrieval failed, not reviewed/);
  assert.match(html, /2026 Solutions for Congested Corridors Program Guidelines Adoption, Resolution G-26-60/);
  assert.match(
    html,
    /href="https:\/\/catc\.ca\.gov\/-\/media\/ctc-media\/documents\/ctc-meetings\/2026\/2026-08\/24-4-10-a11y\.pdf"/,
  );
});

test("renders a separate context watchlist with explicit evidence boundaries", async () => {
  const response = await render("/watchlist");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<main[^>]*id="main-content"/i);
  assert.match(html, /Public developments under review/);
  assert.match(html, /Context, not implementation evidence/);
  assert.match(html, /Context only · Not implementation evidence/);
  assert.match(html, /North Hearing for the Proposed 2026 Solutions for Congested Corridors Program/);
  assert.match(html, /FY 2026 Notice of Funding Opportunity/);
  assert.match(html, /Transit Project Database \(Coming soon!\)/);
  assert.match(html, /No source date stated/);
  assert.match(html, /Retrieval date is not substituted/);
  assert.match(html, /Scheduled event date/);
  assert.match(html, /No explicit order citation/);
  assert.match(html, /Expected artifact not yet published/);
  assert.match(html, /Related directives \(editorial\)/);
  assert.match(html, /href="\/data\/watchlist\.json"/);
  assert.match(html, /href="\/data\/watchlist\.csv"/);
  assert.match(html, /rel="canonical"[^>]+\/watchlist/i);
  assert.doesNotMatch(html, /percent complete|on track/i);
});

test("renders directive context after the three canonical layers", async () => {
  const response = await render("/directives/n-7-26-1a");
  assert.equal(response.status, 200);
  const html = await response.text();

  assertTextOrder(html, [
    "What the signed order says",
    "What is documented publicly",
    "Analytical crosswalk",
    "Related context under review",
  ]);
  assert.match(html, /Caltrans Bay Area Completes First-of-its-Kind District Transit Plan/);
  assert.match(html, /Transit Project Database \(Coming soon!\)/);
  assert.match(html, /Separate research watchlist/);
  assert.match(html, /Topic alignment/);
  assert.match(html, /Publication watch/);
  assert.match(
    html,
    /These official sources are research leads, not implementation evidence\./,
  );
});

test("renders source relationships before separately labeled analytical cross-references", async () => {
  const response = await render("/handoffs");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<main[^>]*id="main-content"/i);
  assert.match(html, /Delivery relationships/);
  assert.match(html, /Executive Order N-7-26/);
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
    ["/methodology", /Keep source, evidence, context, and interpretation apart\./],
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
      assert.match(html, /href="\/data\/watchlist\.json"/);
      assert.match(html, /href="\/data\/watchlist\.csv"/);
      assert.match(html, /href="\/data\/watchlist-schema\.json"/);
      assert.match(html, /record_directive_id/);
      assert.match(
        html,
        /href="https:\/\/github\.com\/ChelseaKR\/transit-delivery-atlas\/issues\/new\?template=01-content-correction\.yml"/,
      );
      // Code relicensed MIT -> Apache-2.0 (see CHANGELOG); this page must state
      // the current license, not the superseded one.
      assert.match(html, /Code is licensed under the Apache License 2\.0/);
      assert.doesNotMatch(html, /MIT licens/i);
    }
  }
});

test("no rendered page anywhere in the site claims the superseded MIT code license", async () => {
  // The code license moved MIT -> Apache-2.0 (CHANGELOG [Unreleased], LICENSE,
  // CONTENT-LICENSE.md, README "Licensing"). A single stale mention on the
  // /data page went undetected by the earlier release checks, so this check
  // covers every exported HTML file rather than one known route.
  const outDir = new URL("../out/", import.meta.url);
  const entries = await readdir(outDir, { recursive: true, withFileTypes: true });
  const htmlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => `${entry.parentPath ?? entry.path}/${entry.name}`);

  assert.ok(htmlFiles.length > 10, "expected the full static export to be built");

  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, "utf8");
    assert.doesNotMatch(
      html,
      /MIT licens/i,
      `${filePath.replace(outDir.pathname, "")} still claims the superseded MIT code license`,
    );
  }
});
