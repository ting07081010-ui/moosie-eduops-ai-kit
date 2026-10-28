import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const readme = readFileSync(path.join(ROOT, "README.md"), "utf8");
const slashReadme = readFileSync(path.join(ROOT, "examples/line-webhook-demo/README.md"), "utf8");
const slashServer = readFileSync(path.join(ROOT, "examples/line-webhook-demo/server.mjs"), "utf8");
const demoScript = readFileSync(path.join(ROOT, "docs/demo-script.md"), "utf8");

describe("LINE command and documentation consistency", () => {
  it("maps the explicit commands and legacy aliases to the intended servers", () => {
    assert.match(packageJson.scripts["line:quick-reply"], /src\/adapters\/line-webhook-server\.mjs$/);
    assert.match(packageJson.scripts["line:slash-demo"], /examples\/line-webhook-demo\/server\.mjs$/);
    assert.equal(packageJson.scripts.line, packageJson.scripts["line:quick-reply"]);
    assert.equal(packageJson.scripts["line:demo"], packageJson.scripts["line:slash-demo"]);
  });

  it("documents the distinct routes and gives the slash demo its explicit start command", () => {
    assert.match(readme, /npm run line:quick-reply/);
    assert.match(readme, /npm run line:slash-demo/);
    assert.match(readme, /does \*\*not\*\* implement `\/summary`, `\/risk`,/);
    assert.match(readme, /Unknown slash commands and other text receive the command guide/);
    assert.match(slashReadme, /npm run line:slash-demo/);
    assert.match(slashServer, /npm run line:slash-demo/);
    assert.match(demoScript, /npm run line:slash-demo/);
  });
});
