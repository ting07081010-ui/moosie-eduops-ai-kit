import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../examples/moosi-say-demo/server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.join(__dirname, "..", "examples", "moosi-say-demo", "data");
const students = JSON.parse(fs.readFileSync(path.join(demoDir, "students.json"), "utf8"));
const unit = JSON.parse(fs.readFileSync(path.join(demoDir, "unit5.json"), "utf8"));

describe("moosi-say synthetic roster (offline)", () => {
  it("has exactly 10 profiles", () => {
    assert.equal(students.length, 10);
  });

  it("has unique, well-formed codes S-007..S-016", () => {
    const codes = students.map((s) => s.studentCode);
    assert.deepEqual([...codes].sort(), [
      "S-007", "S-008", "S-009", "S-010", "S-011",
      "S-012", "S-013", "S-014", "S-015", "S-016",
    ]);
    assert.equal(new Set(codes).size, 10);
    for (const c of codes) assert.match(c, /^S-\d{3}$/);
  });

  it("keeps level/unit on Unit 5 and non-empty allowlisted weakWords", () => {
    const allow = new Set(unit.words);
    for (const s of students) {
      assert.equal(s.level, unit.level);
      assert.equal(s.unit, unit.unit);
      assert.ok(Array.isArray(s.weakWords) && s.weakWords.length > 0, `${s.studentCode} weakWords non-empty`);
      for (const w of s.weakWords) assert.ok(allow.has(w), `${s.studentCode} word ${w} in allowlist`);
    }
  });

  it("carries no PII fields", () => {
    const banned = ["phone", "email", "school", "address", "realName", "real_name"];
    for (const s of students) {
      for (const k of banned) assert.ok(!(k in s), `${s.studentCode} must not have ${k}`);
    }
  });

  it("/api/context exposes an explicit safe-field shape", async () => {
    const { app } = createApp();
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.on("listening", r));
    try {
      const port = server.address().port;
      const res = await fetch(`http://127.0.0.1:${port}/api/context`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.students.length, 10);
      const allowed = new Set(["studentCode", "nickname", "level", "unit", "weakWords"]);
      const allow = new Set(unit.words);
      for (const s of data.students) {
        assert.deepEqual(new Set(Object.keys(s)), allowed);
        assert.ok(s.weakWords.length > 0);
        for (const w of s.weakWords) assert.ok(allow.has(w));
      }
    } finally {
      server.close();
    }
  });
});
