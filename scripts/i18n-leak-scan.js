#!/usr/bin/env node
"use strict";
/*
 * i18n leak scanner (dev tool, not part of the test suite).
 *
 * Replicates the runtime translation that an English user actually receives:
 *   1. text(zh, en)          -> en is used directly (handled, ignored here)
 *   2. STATIC_EN_TEXT[zh]    -> exact dictionary hit
 *   3. otherwise             -> longest-first substring replacement using the
 *                               dictionary (applyGenericStaticTranslations)
 *
 * Anything that still contains Chinese after step 2/3 is a leak: it renders as
 * Chinese for English users. We scan static markup (index.html) and the Chinese
 * string/template literals in app.js that are NOT the first argument of text()
 * (or createLocalizedLookup, whose zh side always has a parallel en side).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

const CJK = /[㐀-鿿豈-﫿]/;

const SENTINEL = String.fromCharCode(1); // marks where a ${...} was removed

// ---- 1. Extract STATIC_EN_TEXT (base literal + Object.assign extension) -----
function extractBalancedObject(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`marker not found: ${startMarker}`);
  }
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  let inStr = null;
  let escaped = false;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (inStr) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === inStr) {
        inStr = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart, i + 1);
      }
    }
  }
  throw new Error("unbalanced object literal");
}

const dictBase = extractBalancedObject(appSource, "const STATIC_EN_TEXT = {");
const STATIC_EN_TEXT = new Function(`return (${dictBase});`)();
// Merge every  Object.assign(STATIC_EN_TEXT, { ... })  extension block.
{
  const marker = "Object.assign(STATIC_EN_TEXT, {";
  let idx = 0;
  while ((idx = appSource.indexOf(marker, idx)) !== -1) {
    const block = extractBalancedObject(appSource.slice(idx), marker);
    Object.assign(STATIC_EN_TEXT, new Function(`return (${block});`)());
    idx += marker.length;
  }
}
// ACCESS_EN_TEXT is an equivalent zh->en map applied via accessText() at the
// access-matrix render sites. Merge it so its source definitions and the access
// matrix literals are not falsely flagged.
const dictAccess = extractBalancedObject(appSource, "const ACCESS_EN_TEXT = {");
Object.assign(STATIC_EN_TEXT, new Function(`return (${dictAccess});`)());

const phraseEntries = Object.entries(STATIC_EN_TEXT)
  .filter(([zh]) => Array.from(zh).length > 1)
  .sort((a, b) => b[0].length - a[0].length);

function translate(value) {
  if (!value) {
    return value;
  }
  if (STATIC_EN_TEXT[value]) {
    return STATIC_EN_TEXT[value];
  }
  if (!CJK.test(value)) {
    return value;
  }
  return phraseEntries.reduce((res, [zh, en]) => res.split(zh).join(en), value);
}

// ---- 2. Strip handled-call expressions so their zh args aren't flagged -----
// Char scanner: blank every  text(...) / createLocalizedLookup(...) call
// expression in place (preserving length + newlines so offset->line stays
// accurate). Both wrap zh strings that have parallel en strings.
const STRIP_CALLS = ["text(", "createLocalizedLookup(", "drawingSpecText("];
function stripHandledCalls(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const marker = STRIP_CALLS.find(
      (name) =>
        source.startsWith(name, i) &&
        (i === 0 || !/[A-Za-z0-9_$.]/.test(source[i - 1])),
    );
    if (marker) {
      const callOpen = i + marker.length - 1; // index of '('
      let depth = 0;
      let j = callOpen;
      let inStr = null;
      let escaped = false;
      for (; j < n; j += 1) {
        const ch = source[j];
        if (inStr) {
          if (escaped) {
            escaped = false;
          } else if (ch === "\\") {
            escaped = true;
          } else if (ch === inStr) {
            inStr = null;
          }
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          inStr = ch;
        } else if (ch === "(") {
          depth += 1;
        } else if (ch === ")") {
          depth -= 1;
          if (depth === 0) {
            j += 1;
            break;
          }
        }
      }
      for (let k = i; k < j; k += 1) {
        out += source[k] === "\n" ? "\n" : " ";
      }
      i = j;
      continue;
    }
    out += source[i];
    i += 1;
  }
  return out;
}

// ---- 3. Collect Chinese-bearing string/template literals from a JS source --
function collectChineseLiterals(source) {
  const findings = [];
  const lineStarts = [0];
  for (let k = 0; k < source.length; k += 1) {
    if (source[k] === "\n") {
      lineStarts.push(k + 1);
    }
  }
  const offsetToLine = (off) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= off) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo + 1;
  };

  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      const startOff = i;
      let buf = "";
      let escaped = false;
      i += 1;
      for (; i < n; i += 1) {
        const c = source[i];
        if (escaped) {
          buf += c;
          escaped = false;
          continue;
        }
        if (c === "\\") {
          escaped = true;
          continue;
        }
        if (c === quote) {
          i += 1;
          break;
        }
        if (quote === "`" && c === "$" && source[i + 1] === "{") {
          let d = 0;
          i += 1;
          for (; i < n; i += 1) {
            if (source[i] === "{") {
              d += 1;
            } else if (source[i] === "}") {
              d -= 1;
              if (d === 0) {
                break;
              }
            }
          }
          buf += SENTINEL;
          continue;
        }
        buf += c;
      }
      if (CJK.test(buf)) {
        findings.push({ value: buf, line: offsetToLine(startOff) });
      }
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") {
        i += 1;
      }
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
      continue;
    }
    i += 1;
  }
  return findings;
}

// Extract contiguous Chinese-bearing runs from a (partially translated) value.
function chineseRuns(value) {
  const runs = [];
  const re = /[㐀-鿿豈-﫿][㐀-鿿豈-﫿　-〿＀-￯·A-Za-z0-9\s]*/g;
  let m;
  while ((m = re.exec(value))) {
    const run = m[0].trim();
    if (CJK.test(run)) {
      runs.push(run);
    }
  }
  return runs;
}

// Split a string literal into translation units that mirror what the runtime
// actually translates: for HTML-bearing literals, the DOM text nodes (text
// between > and <) plus a few translated attributes; for plain literals, the
// whole thing. This matches applyGenericStaticTranslations granularity.
function cleanPhrase(s) {
  return s.replace(/^[>}`)\]]+/, "").replace(/[<{`([]+$/, "").trim();
}
// A ${...} interpolation breaks a DOM text node in two. Split on the sentinel
// so each side is reported as its own translation unit (matches what the
// runtime DOM walker sees: separate text nodes around the dynamic value).
function splitOnSentinel(s) {
  return s.split(SENTINEL).map((p) => cleanPhrase(p)).filter(Boolean);
}
function literalToPhrases(value) {
  if (!value.includes("<") && !value.includes(">")) {
    return splitOnSentinel(value);
  }
  const phrases = [];
  const textRe = />([^<]*)</g;
  let m;
  while ((m = textRe.exec(value))) {
    phrases.push(...splitOnSentinel(m[1]));
  }
  // leading text before first tag / trailing after last tag
  const firstTag = value.indexOf("<");
  if (firstTag > 0) {
    phrases.push(...splitOnSentinel(value.slice(0, firstTag)));
  }
  const lastTag = value.lastIndexOf(">");
  if (lastTag >= 0 && lastTag < value.length - 1) {
    phrases.push(...splitOnSentinel(value.slice(lastTag + 1)));
  }
  // translated attributes inside the literal
  const attrRe2 = /(placeholder|aria-label|title|data-tooltip)\s*=\s*["']([^"']*)["']/g;
  let am2;
  while ((am2 = attrRe2.exec(value))) {
    const a = am2[2].trim();
    if (a) {
      phrases.push(a);
    }
  }
  return phrases;
}

// ---- app.js scan ----------------------------------------------------------
const strippedApp = stripHandledCalls(appSource);
const appLiterals = collectChineseLiterals(strippedApp);
// Map original-phrase -> {line, residual}. Phrase granularity = DOM text node.
// Reject phrases that are actually code captured by template-literal parse
// edge cases (nested ${} with strings/backticks). Real UI text never contains
// these tokens or raw newlines.
const CODE_HINT = /[\n]|\$\{|=>|!==|===|\.\w+\(|\bfunction\b|\breturn\b|=\s*["'`]|\|\||&&|\);|\}\)|;\s*$/;
const appLeaks = new Map();
for (const lit of appLiterals) {
  for (const rawPhrase of literalToPhrases(lit.value)) {
    const phrase = cleanPhrase(rawPhrase);
    if (!phrase || !CJK.test(phrase) || CODE_HINT.test(phrase)) {
      continue;
    }
    const translated = translate(phrase);
    if (CJK.test(translated) && !appLeaks.has(phrase)) {
      appLeaks.set(phrase, { line: lit.line, residual: chineseRuns(translated).join(" / ") });
    }
  }
}

// ---- 4. English-side dictionary values that are still Chinese --------------
const enValueLeaks = [];
for (const [zh, en] of Object.entries(STATIC_EN_TEXT)) {
  if (CJK.test(en)) {
    enValueLeaks.push(`STATIC_EN_TEXT["${zh}"] -> "${en}"`);
  }
}
{
  let idx = 0;
  while ((idx = appSource.indexOf("createLocalizedLookup(", idx)) !== -1) {
    try {
      const objText = extractBalancedObject(appSource.slice(idx), "createLocalizedLookup(");
      const enObjText = extractBalancedObject(objText, "en:");
      const enObj = new Function(`return (${enObjText});`)();
      for (const [k, v] of Object.entries(enObj)) {
        if (typeof v === "string" && CJK.test(v)) {
          const line = appSource.slice(0, idx).split("\n").length;
          enValueLeaks.push(`createLocalizedLookup(app.js:${line}) en["${k}"] -> "${v}"`);
        }
      }
    } catch {
      // ignore blocks we can't statically read
    }
    idx += "createLocalizedLookup(".length;
  }
}

// ---- index.html scan ------------------------------------------------------
const htmlSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const htmlNoScript = htmlSource
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "");
const htmlLeaks = new Map();
const textRe = />([^<]+)</g;
let tm;
while ((tm = textRe.exec(htmlNoScript))) {
  const raw = tm[1].replace(/&[a-z]+;/g, " ").trim();
  if (!CJK.test(raw)) {
    continue;
  }
  const translated = translate(raw);
  if (CJK.test(translated) && !htmlLeaks.has(raw)) {
    htmlLeaks.set(raw, chineseRuns(translated).join(" / "));
  }
}
const attrRe = /(placeholder|aria-label|title|data-tooltip)\s*=\s*"([^"]*)"/g;
const htmlAttrLeaks = new Map();
let am;
while ((am = attrRe.exec(htmlNoScript))) {
  const raw = am[2].trim();
  if (!CJK.test(raw)) {
    continue;
  }
  const translated = translate(raw);
  if (CJK.test(translated)) {
    for (const run of chineseRuns(translated)) {
      if (!STATIC_EN_TEXT[run]) {
        htmlAttrLeaks.set(run, am[1]);
      }
    }
  }
}

// ---- report ---------------------------------------------------------------
console.log(`Dictionary entries: ${Object.keys(STATIC_EN_TEXT).length}`);

console.log(`\n=== English-side values still Chinese (incomplete translations): ${enValueLeaks.length} ===`);
enValueLeaks.forEach((l) => console.log(`  ${l}`));

console.log(`\n=== app.js leaks (original source strings, Chinese outside text() and not dict-covered): ${appLeaks.size} ===`);
[...appLeaks.entries()]
  .sort((a, b) => a[1].line - b[1].line)
  .forEach(([orig, info]) => console.log(`  app.js:${info.line}  «${orig}»  [residual: ${info.residual}]`));

console.log(`\n=== index.html text leaks (original source strings): ${htmlLeaks.size} ===`);
[...htmlLeaks.entries()].forEach(([raw, residual]) => console.log(`  «${raw}»  [residual: ${residual}]`));

console.log(`\n=== index.html attribute leaks: ${htmlAttrLeaks.size} ===`);
[...htmlAttrLeaks.entries()].forEach(([run, attr]) => console.log(`  [${attr}]  ${run}`));

console.log(
  `\nTOTAL distinct leaks: ${appLeaks.size + htmlLeaks.size + htmlAttrLeaks.size} (+${enValueLeaks.length} incomplete en values)`,
);
