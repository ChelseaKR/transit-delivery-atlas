// Google Analytics 4 (ADR-0003): absent with no ID, silent off the production
// host and under GPC, DNT or the footer opt-out, configured exactly as decided
// everywhere else, and never handed the explorers' free-text filters.
//
// The loader is run, not grepped: `runInNewContext` executes the exact string
// `app/layout.tsx` renders against stubbed `window`, `navigator`, `document`
// and `localStorage`, because a string search over a script cannot show what
// the script does. Every negative control asserts that its sabotage landed
// (the guard occurred exactly once and is gone from the sabotaged copy) before
// asserting the harness caught it; a sabotage that matched nothing would
// otherwise read as a pass.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import {
  ANALYTICS_DENIED_REGIONS,
  GA4_DATA_RETENTION,
  GA4_MEASUREMENT_ID,
  GTAG_JS_URL,
  OPT_OUT_MESSAGES,
  OPT_OUT_STORAGE_KEY,
  PRODUCTION_HOST,
  analyticsEnabled,
  choiceSnapshot,
  loaderScript,
  measurementId,
  privacySignal,
  readStorage,
  scrubLocation,
  scrubReferrer,
  sendPageView,
  setOptedOut,
} from "../lib/analytics.ts";

const root = new URL("../", import.meta.url);
const ID = GA4_MEASUREMENT_ID;

function runLoader(
  script = loaderScript(),
  { hostname = PRODUCTION_HOST, navigator = {}, windowDoNotTrack, storage = {}, storageThrows = false } = {},
) {
  const appended = [];
  const blocked = () => {
    throw new Error("storage blocked");
  };
  const localStorage = storageThrows
    ? { getItem: blocked }
    : { getItem: (key) => (Object.hasOwn(storage, key) ? storage[key] : null) };
  const window = { location: { hostname }, localStorage };
  if (windowDoNotTrack !== undefined) window.doNotTrack = windowDoNotTrack;
  const document = {
    head: { appendChild: (element) => appended.push(element) },
    createElement: (tagName) => ({ tagName, async: false, src: "" }),
  };
  runInNewContext(script, { window, navigator, document });
  const dataLayer = window.dataLayer
    ? JSON.parse(
        JSON.stringify(
          window.dataLayer.map((args) =>
            Array.from(args, (value) =>
              Object.prototype.toString.call(value) === "[object Date]" ? "<date>" : value,
            ),
          ),
        ),
      )
    : undefined;
  return {
    dataLayer,
    appended: appended.map(({ tagName, async, src }) => ({ tagName, async, src })),
    gtag: typeof window.gtag,
  };
}

const loaded = (result) => result.dataLayer !== undefined || result.appended.length > 0;

// --- configuration ---

test("the committed ID is the transit.chelseakr.com web stream", () => {
  assert.equal(measurementId(ID), "G-SEHF9W5L74");
  assert.equal(GA4_DATA_RETENTION, "14 months");
  assert.equal(PRODUCTION_HOST, "transit.chelseakr.com");
  assert.equal(analyticsEnabled(), true);
});

test("an unset ID means no GA at all", () => {
  for (const value of [null, undefined, "", "   "]) {
    assert.equal(measurementId(value), null);
    assert.equal(analyticsEnabled(value ?? ""), false);
  }
  assert.equal(loaderScript(""), "");
  assert.equal(loaderScript("  "), "");
});

test("a malformed ID fails the build instead of shipping", () => {
  for (const value of ["UA-12345-1", "G-", "g-sehf9w5l74", 'G-ABC"});alert(1);//', "G-ABCD EFGH"]) {
    assert.throws(() => loaderScript(value), /not a GA4 measurement ID/);
  }
});

test("the denied regions are the EEA, the UK and Switzerland", () => {
  assert.equal(ANALYTICS_DENIED_REGIONS.length, 32);
  assert.equal(new Set(ANALYTICS_DENIED_REGIONS).size, 32);
  for (const code of ["DE", "FR", "IE", "IS", "LI", "NO", "GB", "CH"]) {
    assert.ok(ANALYTICS_DENIED_REGIONS.includes(code), code);
  }
  assert.ok(!ANALYTICS_DENIED_REGIONS.includes("US"));
});

// --- the loader, run ---

const NOTHING_LOADS = {
  "another host": { hostname: "chelseakr.github.io" },
  localhost: { hostname: "localhost" },
  "127.0.0.1": { hostname: "127.0.0.1" },
  GPC: { navigator: { globalPrivacyControl: true } },
  "navigator.doNotTrack": { navigator: { doNotTrack: "1" } },
  "window.doNotTrack": { windowDoNotTrack: "1" },
  "navigator.msDoNotTrack": { navigator: { msDoNotTrack: "1" } },
  'doNotTrack "yes"': { navigator: { doNotTrack: "yes" } },
  "opted out": { storage: { [OPT_OUT_STORAGE_KEY]: "1" } },
};

for (const [name, scenario] of Object.entries(NOTHING_LOADS)) {
  test(`nothing loads: ${name}`, () => {
    const result = runLoader(undefined, scenario);
    assert.equal(result.dataLayer, undefined);
    assert.deepEqual(result.appended, []);
    assert.equal(result.gtag, "undefined");
  });
}

test("on the production host GA loads with the decided configuration", () => {
  const result = runLoader();
  assert.deepEqual(result.appended, [
    { tagName: "script", async: true, src: `${GTAG_JS_URL}?id=${ID}` },
  ]);
  assert.equal(result.gtag, "function");
  const deniedAds = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  assert.deepEqual(result.dataLayer, [
    ["consent", "default", { ...deniedAds, analytics_storage: "denied", region: [...ANALYTICS_DENIED_REGIONS] }],
    ["consent", "default", { ...deniedAds, analytics_storage: "granted" }],
    ["js", "<date>"],
    [
      "config",
      ID,
      { allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: false },
    ],
  ]);
});

test("anything short of a real signal or opt-out still loads", () => {
  for (const scenario of [
    { storage: { [OPT_OUT_STORAGE_KEY]: "0" } },
    { storage: { "some-other-site:analytics-opt-out": "1" } },
    { storageThrows: true },
    { navigator: { doNotTrack: "0", globalPrivacyControl: false } },
  ]) {
    assert.ok(loaded(runLoader(undefined, scenario)), JSON.stringify(scenario));
  }
});

const GUARDS = {
  hostname: [`  if (w.location.hostname !== ${JSON.stringify(PRODUCTION_HOST)}) return;\n`, { hostname: "127.0.0.1" }],
  GPC: ["  if (n.globalPrivacyControl === true) return;\n", { navigator: { globalPrivacyControl: true } }],
  DNT: ['  if (dnt === "1" || dnt === "yes") return;\n', { navigator: { doNotTrack: "1" } }],
  "opt-out": [
    `  try { if (w.localStorage.getItem(${JSON.stringify(OPT_OUT_STORAGE_KEY)}) === "1") return; } catch (e) {}\n`,
    { storage: { [OPT_OUT_STORAGE_KEY]: "1" } },
  ],
};

for (const [name, [line, scenario]] of Object.entries(GUARDS)) {
  test(`negative control: removing the ${name} guard is caught`, () => {
    const script = loaderScript();
    assert.equal(script.split(line).length - 1, 1, `the ${name} guard is not in the loader to remove`);
    const broken = script.replace(line, "");
    assert.ok(broken !== script && !broken.includes(line), "the sabotage landed");
    assert.ok(!loaded(runLoader(script, scenario)), "the intact loader loads nothing here");
    assert.ok(loaded(runLoader(broken, scenario)), `removing the ${name} guard went unnoticed`);
  });
}

test("negative control: turning Google signals on is caught", () => {
  const script = loaderScript();
  const flag = "allow_google_signals: false";
  assert.equal(script.split(flag).length - 1, 1);
  const broken = script.replace(flag, "allow_google_signals: true");
  assert.notEqual(broken, script);
  assert.equal(runLoader(broken).dataLayer.at(-1)[2].allow_google_signals, true);
});

// --- page views on a client-navigated site ---

test("the page address GA receives keeps origin, path and utm_* only", () => {
  assert.equal(
    scrubLocation("https://transit.chelseakr.com/?q=jane%40example.com&theme=fares&utm_source=news&utm_campaign=eo#register"),
    "https://transit.chelseakr.com/?utm_source=news&utm_campaign=eo",
  );
  assert.equal(
    scrubLocation("https://transit.chelseakr.com/handoffs/?bq=my+address&dq=secret&kind=agency"),
    "https://transit.chelseakr.com/handoffs/",
  );
  assert.equal(scrubLocation("https://transit.chelseakr.com/directives/n-7-26-5/"), "https://transit.chelseakr.com/directives/n-7-26-5/");
});

test("an external referrer is reduced to its origin; this site's is scrubbed", () => {
  const origin = "https://transit.chelseakr.com";
  assert.equal(scrubReferrer("https://www.google.com/search?q=who+am+i", origin), "https://www.google.com/");
  assert.equal(scrubReferrer(`${origin}/evidence/?q=typed`, origin), `${origin}/evidence/`);
  assert.equal(scrubReferrer("", origin), "");
  assert.equal(scrubReferrer("not a url", origin), "");
});

function pageViewWindow(href, gtag) {
  const url = new URL(href);
  return { gtag, location: { href, origin: url.origin } };
}

test("one scrubbed page_view per route, with the previous route as referrer", () => {
  const calls = [];
  const gtag = (...args) => calls.push(args);
  const doc = { title: "Directive register | Transit Delivery Atlas", referrer: "https://news.example/story?id=9" };
  let previous = sendPageView(pageViewWindow("https://transit.chelseakr.com/?q=typed+text", gtag), doc, null);
  previous = sendPageView(pageViewWindow("https://transit.chelseakr.com/evidence/?q=more", gtag), { ...doc, title: "Evidence" }, previous);
  // The same scrubbed address again (a filter change in the query) sends nothing.
  assert.equal(sendPageView(pageViewWindow("https://transit.chelseakr.com/evidence/?q=other", gtag), doc, previous), previous);
  assert.deepEqual(calls, [
    [
      "event",
      "page_view",
      {
        page_location: "https://transit.chelseakr.com/",
        page_referrer: "https://news.example/",
        page_title: "Directive register | Transit Delivery Atlas",
      },
    ],
    [
      "event",
      "page_view",
      {
        page_location: "https://transit.chelseakr.com/evidence/",
        page_referrer: "https://transit.chelseakr.com/",
        page_title: "Evidence",
      },
    ],
  ]);
  assert.ok(!JSON.stringify(calls).includes("typed"), "a filter's text reached GA");
});

test("with no loader there is no gtag and no page view", () => {
  assert.equal(sendPageView(pageViewWindow("https://transit.chelseakr.com/", undefined), { title: "t", referrer: "" }, null), null);
  assert.equal(sendPageView(pageViewWindow("https://transit.chelseakr.com/", undefined), { title: "t", referrer: "" }, "x"), "x");
});

// --- the footer control ---

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

test("privacySignal reads GPC and every DNT spelling", () => {
  assert.equal(privacySignal({ navigator: {} }), false);
  assert.equal(privacySignal({ navigator: { globalPrivacyControl: true } }), true);
  assert.equal(privacySignal({ navigator: { doNotTrack: "1" } }), true);
  assert.equal(privacySignal({ navigator: { msDoNotTrack: "1" } }), true);
  assert.equal(privacySignal({ navigator: {}, doNotTrack: "yes" }), true);
  assert.equal(privacySignal({ navigator: { doNotTrack: "0" } }), false);
});

test("the control's state follows signals, storage and the stored choice", () => {
  assert.equal(choiceSnapshot({ navigator: { globalPrivacyControl: true }, localStorage: memoryStorage() }), "signal");
  const blocked = {
    navigator: {},
    get localStorage() {
      throw new Error("denied");
    },
  };
  assert.equal(readStorage(blocked), null);
  assert.equal(choiceSnapshot(blocked), "no-storage");
  assert.equal(choiceSnapshot({ navigator: {}, localStorage: memoryStorage() }), "in");
  assert.equal(choiceSnapshot({ navigator: {}, localStorage: memoryStorage({ [OPT_OUT_STORAGE_KEY]: "1" }) }), "out");
});

test("opting out stores the flag and disables gtag; opting back in clears both", () => {
  const storage = memoryStorage();
  const win = {};
  setOptedOut(storage, win, true);
  assert.deepEqual(storage.data, { [OPT_OUT_STORAGE_KEY]: "1" });
  assert.equal(win[`ga-disable-${ID}`], true);
  // The next page load reads the stored choice before loading anything.
  assert.ok(!loaded(runLoader(undefined, { storage: storage.data })));
  setOptedOut(storage, win, false);
  assert.deepEqual(storage.data, {});
  assert.equal(win[`ga-disable-${ID}`], false);
  assert.ok(loaded(runLoader(undefined, { storage: storage.data })));
  const noId = {};
  setOptedOut(memoryStorage(), noId, true, "");
  assert.deepEqual(Object.keys(noId), []);
});

test("negative control: an opt-out that stores nothing is caught", () => {
  const storage = memoryStorage();
  const broken = { ...storage, setItem: () => {} };
  assert.notEqual(broken.setItem, storage.setItem, "the sabotage landed");
  setOptedOut(broken, {}, true);
  assert.equal(choiceSnapshot({ navigator: {}, localStorage: storage }), "in");
});

test("every status message the control can show is non-empty", () => {
  for (const [name, message] of Object.entries(OPT_OUT_MESSAGES)) {
    assert.ok(message.length > 20, name);
  }
});

// --- the build ---

async function htmlFiles(directory = new URL("out/", root)) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) files.push(...(await htmlFiles(url)));
    else if (entry.name.endsWith(".html")) files.push(url);
  }
  return files;
}

test("every exported page carries the loader once in <head> and the footer disclosure", async () => {
  const pages = await htmlFiles();
  assert.ok(pages.length > 25, `only ${pages.length} pages were exported`);
  const tag = `<script>${loaderScript()}</script>`;
  for (const page of pages) {
    const html = await readFile(page, "utf8");
    const where = page.pathname.split("/out/")[1];
    const [head] = html.split("</head>");
    assert.equal(head.split(tag).length - 1, 1, `${where}: loader in <head>`);
    assert.equal(html.split(tag).length - 1, 1, `${where}: loader rendered as a script exactly once`);
    assert.doesNotMatch(html, /<script[^>]+src="https?:\/\/[^"]*google/i, `${where}: a static Google <script src>`);
    assert.match(html, /<footer[\s\S]*href="\/privacy\/"[\s\S]*<\/footer>/, `${where}: footer privacy link`);
    assert.match(html, /<p class="site-footer__analytics">[^<]*<span role="status"><\/span><\/p>/, `${where}: opt-out status line`);
  }
});

test("the privacy page is exported, in the sitemap, and describes GA", async () => {
  const html = (await readFile(new URL("out/privacy/index.html", root), "utf8")).replaceAll("<!-- -->", "");
  for (const fact of [
    "Google Analytics 4",
    "Global Privacy Control",
    "Do Not Track",
    "Opt out of analytics",
    "Opt back in",
    OPT_OUT_STORAGE_KEY,
    "_ga",
    "two years",
    "cookieless",
    "Switzerland",
    `keeps it for ${GA4_DATA_RETENTION}`,
    "Google signals and ad personalization are off",
    "utm_",
  ]) {
    assert.ok(html.includes(fact), fact);
  }
  const sitemap = await readFile(new URL("out/sitemap.xml", root), "utf8");
  assert.match(sitemap, /<loc>https:\/\/transit\.chelseakr\.com\/privacy\/<\/loc>/);
});

test("the data exports, feeds and change log carry no GA", async () => {
  const targets = ["out/changes.json", "out/changes.xml", "out/sitemap.xml"];
  // The exports are the files `public/data/` holds; `out/data/` also holds the
  // `/data` page's own HTML and navigation payloads, which are pages, not exports.
  for (const entry of await readdir(new URL("public/data/", root))) targets.push(`out/data/${entry}`);
  assert.ok(targets.length > 5);
  for (const target of targets) {
    const text = await readFile(new URL(target, root), "utf8");
    for (const marker of ["googletagmanager", "google-analytics", "gtag(", ID]) {
      assert.ok(!text.includes(marker), `${target} carries ${marker}`);
    }
  }
});

test("the CloudFront CSP allows exactly the GA origins the loader needs", async () => {
  const template = JSON.parse(await readFile(new URL("infra/static-site.json", root), "utf8"));
  const csp =
    template.Resources.SecurityHeadersPolicy.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig
      .ContentSecurityPolicy.ContentSecurityPolicy;
  const directives = Object.fromEntries(
    csp.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );
  assert.deepEqual(directives["script-src"], ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com"]);
  const collection = ["https://*.google-analytics.com", "https://*.analytics.google.com"];
  assert.deepEqual(directives["connect-src"], ["'self'", ...collection]);
  assert.deepEqual(directives["img-src"], ["'self'", "data:", ...collection]);
  assert.deepEqual(directives["default-src"], ["'self'"]);
});
