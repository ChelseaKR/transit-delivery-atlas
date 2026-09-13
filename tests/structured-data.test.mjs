import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const exportRoot = new URL("out/", projectRoot);

/**
 * Nothing in this file imports the code that writes the markup.
 *
 * Asking the generator what the answer is cannot catch a generator that
 * fabricates. Every value below is read out of the built HTML and held against
 * another thing the same built HTML says, so a node that stopped being derived
 * fails here even while it still says something plausible -- which is the only
 * failure worth catching. A node that is merely wrong is rare; a node that is
 * quietly stale is the normal outcome.
 */

/* ------------------------------------------------------------------ *
 * A parser, because a string count is not a measurement.
 * ------------------------------------------------------------------ */

/**
 * Elements whose content is text rather than markup, and so must be consumed
 * whole: a `<` inside a JSON-LD payload is not the start of a tag.
 */
const RAW_TEXT = new Set(["script", "style", "title", "textarea"]);

const NAMED_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
]);

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED_ENTITIES.get(body.toLowerCase()) ?? match;
  });
}

function readAttributes(raw) {
  const attrs = {};
  const pattern = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of raw.matchAll(pattern)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

/**
 * Every start tag in a document, with its attributes and -- for a raw-text
 * element -- its undecoded content.
 *
 * Written as a tokenizer rather than a regular expression over the page for a
 * specific reason. The portfolio audit that asked for this markup scored a
 * sibling project as carrying structured data because the string
 * `application/ld+json` appeared on its page; the single occurrence was the
 * `accept` attribute of a file picker. A count of a string scores an upload
 * widget as a schema.org node and misses a real node written with unusual
 * spacing. So this matches on the element and on its `type` attribute, and on
 * nothing else.
 */
function readTags(html) {
  const tags = [];
  let index = 0;

  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open === -1) break;

    if (html.startsWith("<!--", open)) {
      const close = html.indexOf("-->", open);
      index = close === -1 ? html.length : close + 3;
      continue;
    }
    if (html.startsWith("<!", open) || html.startsWith("<?", open)) {
      const close = html.indexOf(">", open);
      index = close === -1 ? html.length : close + 1;
      continue;
    }

    const name = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(open, open + 64));
    if (!name) {
      index = open + 1;
      continue;
    }

    // Scan to the tag's `>`, ignoring one inside a quoted attribute value.
    let cursor = open + name[0].length;
    let quote = null;
    for (; cursor < html.length; cursor += 1) {
      const character = html[cursor];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
    }

    const rawAttributes = html.slice(open + name[0].length, cursor);
    const tag = name[2].toLowerCase();
    const closing = name[1] === "/";
    let text = null;
    let next = cursor + 1;

    if (!closing && RAW_TEXT.has(tag) && !rawAttributes.trimEnd().endsWith("/")) {
      const end = new RegExp(`</${tag}\\s*>`, "i").exec(html.slice(next));
      text = end ? html.slice(next, next + end.index) : html.slice(next);
      next = end ? next + end.index + end[0].length : html.length;
    }

    if (!closing) tags.push({ tag, attrs: readAttributes(rawAttributes), text });
    index = next;
  }

  return tags;
}

/** The half of a page a crawler reads, as elements rather than as a string. */
function readHead(html) {
  const head = { lang: "", title: "", meta: {}, canonical: "", blocks: [] };

  for (const { tag, attrs, text } of readTags(html)) {
    if (tag === "html") {
      head.lang = attrs.lang ?? "";
    } else if (tag === "title" && head.title === "") {
      head.title = decodeEntities(text ?? "");
    } else if (tag === "meta") {
      const key = attrs.name ?? attrs.property;
      if (key) head.meta[key] = attrs.content ?? "";
    } else if (tag === "link" && (attrs.rel ?? "").toLowerCase() === "canonical") {
      head.canonical = attrs.href ?? "";
    } else if (tag === "script" && (attrs.type ?? "").trim().toLowerCase() === "application/ld+json") {
      head.blocks.push(text ?? "");
    }
  }

  return head;
}

/* ------------------------------------------------------------------ *
 * What the build actually produced.
 * ------------------------------------------------------------------ */

async function htmlFiles(directory = exportRoot, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await htmlFiles(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`)));
    } else if (entry.name.endsWith(".html")) {
      files.push(`${prefix}${entry.name}`);
    }
  }
  return files.sort();
}

/** The path a built file is served at, under `trailingSlash: true`. */
function servedPath(file) {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) return `/${file.slice(0, -"index.html".length)}`;
  return `/${file}`;
}

/**
 * The three exports that are not routes.
 *
 * Next.js writes the not-found page to all three paths. None carries a
 * canonical, all three carry `noindex` (asserted in `tests/hosting.test.mjs`),
 * and a 404 that described itself as a page of this site would be asserting a
 * URL the site does not serve. They are named rather than filtered by "has no
 * canonical", so that a real page losing its canonical cannot quietly drop out
 * of the examined set.
 */
const NOT_ROUTES = new Set(["404.html", "404/index.html", "_not-found/index.html"]);

const files = await htmlFiles();
const pages = new Map(
  await Promise.all(
    files.map(async (file) => [file, readHead(await readFile(new URL(file, exportRoot), "utf8"))]),
  ),
);

const sitemap = await readFile(new URL("sitemap.xml", exportRoot), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const origins = new Set(sitemapUrls.map((url) => new URL(url).origin));
const origin = [...origins][0];
const servedUrls = new Set(sitemapUrls);

const examinable = files.filter((file) => !NOT_ROUTES.has(file));
const examined = examinable.filter((file) => pages.get(file).blocks.length > 0);

/** Every node of a page's single block, keyed by `@id`. */
function graph(file) {
  const blocks = pages.get(file).blocks;
  assert.equal(blocks.length, 1, `${file} carries ${blocks.length} ld+json blocks, expected 1`);
  const payload = JSON.parse(blocks[0]);
  assert.equal(payload["@context"], "https://schema.org", `${file}: wrong @context`);
  assert.ok(Array.isArray(payload["@graph"]), `${file}: @graph is not a list`);
  const nodes = {};
  for (const node of payload["@graph"]) {
    assert.ok(node["@id"], `${file}: a node has no @id`);
    nodes[node["@id"]] = node;
  }
  return nodes;
}

function nodeOfType(file, type) {
  const found = Object.values(graph(file)).filter((node) => node["@type"] === type);
  assert.equal(found.length, 1, `${file} carries ${found.length} ${type} nodes, expected 1`);
  return found[0];
}

/* ------------------------------------------------------------------ *
 * The gate.
 * ------------------------------------------------------------------ */

test("there is a built site to examine", () => {
  // Every assertion below loops over a set read off the disk. If any of those
  // sets came back empty the whole file would pass having read nothing, which
  // is the shape of a gate that cannot fail.
  assert.ok(files.length > 0, "out/ holds no HTML");
  assert.ok(sitemapUrls.length > 0, "the built sitemap lists no URL");
  assert.equal(origins.size, 1, `the sitemap spans ${origins.size} origins`);
  assert.ok(examinable.length > 0, "every built page was treated as exempt");
});

test("every page the sitemap serves carries a structured-data block", (t) => {
  t.diagnostic(`structured data examined on ${examined.length} of ${examinable.length} pages`);

  // Two numbers, not one. A gate that reads the home page and reports that the
  // site carries structured data is the failure this suite exists to prevent.
  assert.equal(
    examined.length,
    examinable.length,
    `pages carrying no block: ${examinable.filter((file) => !examined.includes(file)).join(", ")}`,
  );
  assert.equal(
    examinable.length,
    sitemapUrls.length,
    "the examined set and the sitemap disagree about how many pages this site has",
  );
});

test("only the not-found exports are exempt, and they describe nothing", () => {
  // Derived, so a new page cannot join the exempt set by being added. A file
  // outside the sitemap that is not one of the three known error exports fails
  // here rather than silently going unexamined.
  const unserved = files.filter((file) => !servedUrls.has(`${origin}${servedPath(file)}`));
  assert.deepEqual(new Set(unserved), NOT_ROUTES);

  for (const file of NOT_ROUTES) {
    assert.deepEqual(pages.get(file).blocks, [], `${file} must not claim to be a page of this site`);
  }
});

test("every block is valid JSON describing a page, a site, a trail and a card", () => {
  for (const file of examinable) {
    const types = Object.values(graph(file)).map((node) => node["@type"]);
    assert.deepEqual(
      new Set(types),
      new Set(["WebSite", "WebPage", "BreadcrumbList", "ImageObject"]),
      `${file} publishes an unexpected set of node types`,
    );
  }
});

test("the page node repeats the page's own head", () => {
  for (const file of examinable) {
    const head = pages.get(file);
    const page = nodeOfType(file, "WebPage");

    assert.equal(page.name, head.title, `${file}: node name is not the <title>`);
    assert.equal(
      page.description,
      head.meta.description,
      `${file}: node description is not the meta description`,
    );
    assert.equal(page.url, head.canonical, `${file}: node url is not the canonical`);
    assert.equal(page.inLanguage, head.lang, `${file}: node language is not the document's`);

    // And the canonical is the URL of the file it was written to, so the head
    // and the node can agree with each other and still not be wrong about where
    // the page is.
    assert.equal(head.canonical, `${origin}${servedPath(file)}`, `${file}: canonical is not this file`);
  }
});

test("the site node repeats the page's own site name", () => {
  for (const file of examinable) {
    const head = pages.get(file);
    const site = nodeOfType(file, "WebSite");
    assert.equal(site.name, head.meta["og:site_name"], `${file}: site name drifted`);
    assert.equal(site.url, `${origin}/`, `${file}: site url drifted`);
    assert.equal(site.inLanguage, head.lang, `${file}: site language drifted`);
  }
});

test("the image node repeats the card the head names, and the card itself", async () => {
  // The tags and the node can agree with each other and both be wrong about the
  // file, which is what they were before either of them read it.
  const png = await readFile(new URL("public/og.png", projectRoot));
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "public/og.png is not a PNG",
  );
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  for (const file of examinable) {
    const head = pages.get(file);
    const image = nodeOfType(file, "ImageObject");
    assert.equal(image.url, head.meta["og:image"], `${file}: card url drifted`);
    assert.equal(image.caption, head.meta["og:image:alt"], `${file}: card caption drifted`);
    assert.equal(String(image.width), head.meta["og:image:width"], `${file}: card width drifted`);
    assert.equal(String(image.height), head.meta["og:image:height"], `${file}: card height drifted`);
    assert.equal(image.width, width, `${file}: card width is not the PNG's`);
    assert.equal(image.height, height, `${file}: card height is not the PNG's`);
  }
});

test("every breadcrumb trail resolves to routes the site actually serves", () => {
  for (const file of examinable) {
    const head = pages.get(file);
    const trail = nodeOfType(file, "BreadcrumbList").itemListElement;

    assert.ok(Array.isArray(trail) && trail.length > 0, `${file}: empty trail`);
    trail.forEach((item, index) => {
      assert.equal(item["@type"], "ListItem", `${file}: trail carries a non-ListItem`);
      assert.equal(item.position, index + 1, `${file}: trail positions are not contiguous`);
      assert.ok(
        servedUrls.has(item.item),
        `${file}: trail step ${index + 1} points at ${item.item}, which the site does not serve`,
      );
    });

    assert.equal(trail[0].item, `${origin}/`, `${file}: a trail must start at the site root`);
    assert.equal(trail.at(-1).item, head.canonical, `${file}: a trail must end at this page`);
    assert.ok(
      head.title.includes(trail.at(-1).name),
      `${file}: the last crumb says "${trail.at(-1).name}", the title says "${head.title}"`,
    );
  }
});

test("no node points at an @id the graph does not define", () => {
  // `"about": {"@id": ...}` naming a node that is not in the graph is a
  // reference to nothing, and consumers drop it silently rather than
  // complaining. It reads as a described page and is an empty one.
  for (const file of examinable) {
    const nodes = graph(file);
    for (const node of Object.values(nodes)) {
      for (const [key, value] of Object.entries(node)) {
        if (value && typeof value === "object" && !Array.isArray(value) && "@id" in value) {
          assert.ok(value["@id"] in nodes, `${file}: ${node["@type"]}.${key} points at an undefined @id`);
        }
      }
    }
  }
});

test("no published property is empty", () => {
  const empty = (value) =>
    value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0);

  for (const file of examinable) {
    for (const node of Object.values(graph(file))) {
      for (const [key, value] of Object.entries(node)) {
        assert.ok(!empty(value), `${file}: ${node["@type"]}.${key} is empty`);
      }
    }
  }
});

test("it solicits no dataset harvest and publishes no per-record node", () => {
  // Deliberate and permanent, not an oversight to be filled in later.
  //
  // A `Dataset` node, or DCAT beside it, is not a description -- it is an
  // invitation. It exists so that dataset search engines and open-data catalogs
  // harvest the thing it names and list it as a dataset of record, and a
  // catalog listing is far easier to acquire than to withdraw. This site is an
  // explicitly unofficial reading of a signed state order, and whether an
  // unofficial model of a government instrument should solicit that indexing is
  // an open question with an owner's name on it.
  //
  // A node per directive is the same thing wearing a different `@type`. Thirty
  // pages each carrying a machine-readable record of a government directive is
  // a derived corpus published for harvest whatever it is called, and
  // `Legislation` or `GovernmentService` would additionally read as the State
  // of California publishing this. The site says on every page that it is not.
  //
  // The allowlist is the enforcement: a type that is not one of the four
  // node types this markup exists to publish fails here, named or not.
  const allowed = new Set(["WebSite", "WebPage", "BreadcrumbList", "ImageObject", "ListItem"]);
  const forbiddenKeys = new Set(["distribution", "dataset", "catalog", "measurementTechnique"]);
  const forbiddenText = ["dcat:", "dct:", "void:", "dcterms:", "schema:Dataset"];

  const walk = (file, value) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(file, item);
      return;
    }
    if (!value || typeof value !== "object") return;
    if ("@type" in value) {
      assert.ok(allowed.has(value["@type"]), `${file}: ${value["@type"]} is not an authorised node type`);
    }
    for (const [key, nested] of Object.entries(value)) {
      assert.ok(!forbiddenKeys.has(key), `${file}: "${key}" is harvest vocabulary`);
      walk(file, nested);
    }
  };

  for (const file of examinable) {
    const raw = pages.get(file).blocks.join("");
    for (const word of forbiddenText) {
      assert.ok(!raw.includes(word), `${file}: "${word}" is harvest vocabulary`);
    }
    walk(file, JSON.parse(raw));
  }
});
