import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../dist/", import.meta.url);
const files = walk(root.pathname).map((path) => path.slice(root.pathname.length));
const index = readFileSync(new URL("index.html", root), "utf8");

assert.match(index, /(?:src|href)="\/clocktower\//, "build assets must use the /clocktower/ Pages base");
for (const page of ["index.html", "trouble-brewing/index.html", "sects-and-violets/index.html"]) {
  assert.ok(files.includes(page), `production page is missing: ${page}`);
}
for (const logo of ["assets/scripts/trouble-brewing.png", "assets/scripts/sects-and-violets.png"]) {
  assert.ok(files.includes(logo), `official script logo is missing: ${logo}`);
}

const landingEntryPath = index.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
assert.ok(landingEntryPath, "landing entry script is missing");
const landingEntry = readFileSync(new URL(landingEntryPath.replace("/clocktower/", ""), root), "utf8");
assert.equal(landingEntry.includes("clocktower_wasm"), false, "landing entry must not load the WASM game core");

const manifestFile = files.find((file) => file.endsWith(".webmanifest"));
assert.ok(manifestFile, "web manifest is missing from the production build");
const manifest = JSON.parse(readFileSync(new URL(manifestFile, root), "utf8"));
assert.equal(manifest.id, "/clocktower/");
assert.equal(manifest.lang, "ko");
assert.equal(manifest.start_url, "/clocktower/");
assert.equal(manifest.scope, "/clocktower/");
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons?.some((icon) => icon.sizes === "192x192"), "192px install icon is missing");
assert.ok(manifest.icons?.some((icon) => icon.sizes === "512x512"), "512px install icon is missing");
assert.ok(manifest.icons?.some((icon) => icon.purpose === "maskable"), "maskable install icon is missing");

assert.ok(files.includes("sw.js"), "generated Service Worker is missing");
const serviceWorker = readFileSync(new URL("sw.js", root), "utf8");
for (const requiredAsset of [
  "trouble-brewing/index.html",
  "sects-and-violets/index.html",
  "assets/scripts/trouble-brewing.png",
  "assets/scripts/sects-and-violets.png",
  ".wasm",
  "assets/characters/tb/washerwoman_g.webp",
  "assets/characters/tb/imp_e.webp",
  "assets/characters/snv/clockmaker_g.webp",
  "assets/characters/snv/fanggu_e.webp",
  "assets/community/ccc-parchment.png",
]) {
  assert.ok(serviceWorker.includes(requiredAsset), `Service Worker precache is missing ${requiredAsset}`);
}

const characterIcons = files.filter((file) => /^assets\/characters\/tb\/.+_[ge]\.webp$/.test(file));
assert.equal(characterIcons.length, 22, "production build must contain all 22 Trouble Brewing icons");
const sectsAndVioletsIcons = files.filter((file) => /^assets\/characters\/snv\/.+_[ge]\.webp$/.test(file));
assert.equal(sectsAndVioletsIcons.length, 25, "production build must contain all 25 Sects & Violets icons");
assert.ok(files.includes("assets/community/ccc-parchment.png"), "CCC logo is missing from production build");
assert.ok(files.some((file) => file.endsWith(".wasm")), "WASM core is missing from production build");

const workflow = join(root.pathname, "../../.github/workflows/deploy-pages.yml");
assert.ok(existsSync(workflow), "GitHub Pages deployment workflow is missing");
const workflowSource = readFileSync(workflow, "utf8");
assert.match(workflowSource, /workflow_dispatch:/, "Pages deployment must support an explicit manual trigger");
assert.equal(/\n\s+push:/.test(workflowSource), false, "Pages deployment must not publish automatically");

console.log("PWA build contract verified");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
