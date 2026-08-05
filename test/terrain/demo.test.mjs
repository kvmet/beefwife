import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../terrain/demo.html", import.meta.url), "utf8");
const scripts = Array.from(
  html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
  (match) => match[1],
);

assert.equal(scripts.length, 2);
assert.match(html, /<script src="\.\/terrain\.min\.js"><\/script>/);
assert.match(html, /Profile cached queries/);
for (const script of scripts) Function(script);

console.log("Terrain demo: safe");
