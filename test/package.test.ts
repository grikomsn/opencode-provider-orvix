import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const root = new URL("..", import.meta.url);

test("package metadata and lockfile versions stay synchronized", () => {
  const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  const lockfile = JSON.parse(readFileSync(new URL("package-lock.json", root), "utf8"));

  assert.equal(lockfile.version, manifest.version);
  assert.equal(lockfile.packages[""].version, manifest.version);
  assert.equal(manifest.exports["."].import, "./plugin.ts");
  assert.equal(manifest.exports["./server"].import, "./plugin.ts");
  assert.equal(manifest.exports["./library"].import, "./index.ts");
});

test("npm package contains the plugin and intended metadata only", () => {
  const output = execFileSync(
    npm,
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: root, encoding: "utf8" }
  );
  const [{ files }] = JSON.parse(output) as [{ files: Array<{ path: string }> }];
  const paths = files.map((file) => file.path);

  for (const required of [
    "plugin.ts",
    "index.ts",
    "CHANGELOG.md",
    "opencode.json",
    "assets/cover.jpg",
  ]) {
    assert.ok(paths.includes(required), `missing ${required}`);
  }
  assert.ok(!paths.includes("assets/icon.png"));
  assert.ok(!paths.some((path) => path.startsWith("test/")));
  assert.ok(!paths.some((path) => path.startsWith(".github/")));
  assert.ok(!paths.some((path) => path.startsWith(".env")));
});
