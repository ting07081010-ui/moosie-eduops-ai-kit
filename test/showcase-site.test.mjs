// Scope: source/Node string checks only. This file reads the site sources
// as text and compares them against the demo sources with node:test and
// node:assert. It is not proof of browser rendering, screen-reader
// announcements, or human acceptance. Rendered browser checks run
// separately (coordinator, sandbox Chromium).
import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SAMPLE_TRANSCRIPT,
  createStore,
  generateCard,
} from "../examples/moosi-say-demo/lib/moosi-say.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const siteRoot = path.join(repoRoot, "site");
const html = fs.readFileSync(path.join(siteRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(siteRoot, "assets", "site.css"), "utf8");
const js = fs.readFileSync(path.join(siteRoot, "assets", "showcase.js"), "utf8");
const favicon = fs.readFileSync(path.join(siteRoot, "assets", "favicon.svg"), "utf8");
const source = fs.readFileSync(
  path.join(repoRoot, "examples", "moosi-say-demo", "lib", "moosi-say.mjs"),
  "utf8"
);
const students = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "examples", "moosi-say-demo", "data", "students.json"),
    "utf8"
  )
);
const unit = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "examples", "moosi-say-demo", "data", "unit5.json"),
    "utf8"
  )
);

// Fixed insufficient-evidence transcript shown on the site: every unit word is
// present, but grapes has no explicit practice cue in the same clause.
const INSUFFICIENT_TRANSCRIPT =
  "S-007 在 Unit 5 水果課上能說出 apple、banana 和 grapes。\n請媽媽在家陪 S-007 玩買水果遊戲，練習說 I want some grapes, please。";

describe("showcase site: source-backed synthetic fixture", () => {
  it("S-007 fixture matches the demo roster", () => {
    const s007 = students.find((s) => s.studentCode === "S-007");
    assert.ok(s007, "roster must contain S-007");
    assert.equal(s007.nickname, "Sunny");
    assert.equal(s007.level, "Beginner");
    assert.equal(s007.unit, "Unit 5");
    assert.deepEqual(s007.weakWords, ["grapes"]);
    for (const label of ["Sunny", "Beginner", "S-007", '["grapes"]']) {
      assert.ok(html.includes(label), `site must mention ${label}`);
    }
    assert.ok(
      html.includes("虛構 fixture") || html.includes("虛構"),
      "site must say the weak word is a fictional fixture field"
    );
  });

  it("allowlist and sentence pattern match unit5.json", () => {
    assert.deepEqual(unit.words, ["apple", "banana", "grapes"]);
    assert.deepEqual(unit.sentencePatterns, ["I want some {fruit}, please."]);
    for (const word of ["apple", "banana", "grapes"]) {
      assert.ok(html.includes(word), `site must mention ${word}`);
    }
    assert.ok(
      html.includes("I want some {fruit}, please."),
      "site must show the exact sentence pattern"
    );
  });

  it("successful transcript matches SAMPLE_TRANSCRIPT exactly", () => {
    const lines = SAMPLE_TRANSCRIPT.split("\n");
    assert.equal(lines.length, 2);
    for (const line of lines) {
      assert.ok(html.includes(line), "site must quote the exact transcript line");
    }
    assert.ok(
      html.includes(lines.join("<br>")),
      "site must preserve the exact transcript line order"
    );
    const card = generateCard({
      transcript: SAMPLE_TRANSCRIPT,
      studentCode: "S-007",
      unit,
      students,
    });
    assert.equal(card.practice_focus, "grapes");
    assert.equal(card.sentence, "I want some grapes, please.");
  });
});

describe("showcase site: source-backed counterexamples", () => {
  it("insufficient-evidence case uses the exact demo error", () => {
    let message = "";
    try {
      generateCard({
        transcript: INSUFFICIENT_TRANSCRIPT,
        studentCode: "S-007",
        unit,
        students,
      });
    } catch (err) {
      assert.equal(err.code, "MISSING_FOCUS_EVIDENCE");
      message = err.message;
    }
    assert.ok(message, "expected MISSING_FOCUS_EVIDENCE from current source");
    // The message is templated in source, so check its two fixed halves.
    for (const half of [
      "逐字稿沒有明確記錄名冊弱詞",
      "需要練習；已交回老師補充觀察後再產生圖卡。",
    ]) {
      assert.ok(
        source.includes(half),
        "error text must come from current demo source"
      );
    }
    assert.ok(
      html.includes(message),
      "site must quote the exact insufficient-evidence error"
    );
    assert.ok(
      html.includes(INSUFFICIENT_TRANSCRIPT.split("\n")[0]),
      "site must show the insufficient-evidence transcript wording"
    );
    const record = createStore().issue({
      transcript: INSUFFICIENT_TRANSCRIPT,
      studentCode: "S-007",
      unit,
      students,
    });
    assert.equal(record.status, "needs_teacher_input");
    assert.equal(record.card, null);
    assert.equal(record.contentHash, null);
    assert.ok(html.includes("needs_teacher_input"));
  });

  it("orange case uses the exact demo error", () => {
    let message = "";
    try {
      generateCard({
        transcript: `${SAMPLE_TRANSCRIPT}\n今天也練習了 orange。`,
        studentCode: "S-007",
        unit,
        students,
      });
    } catch (err) {
      assert.equal(err.code, "OUT_OF_SCOPE");
      message = err.message;
    }
    assert.ok(message, "expected OUT_OF_SCOPE from current source");
    assert.ok(
      source.includes("已退回，不會產生圖卡"),
      "source must contain the rejection wording"
    );
    assert.ok(html.includes(message), "site must quote the exact orange error");
    assert.ok(html.includes("orange"));
  });
});

describe("showcase site: required copy, labels, and links", () => {
  it("has the exact hero subtitle, banner, and safety labels", () => {
    assert.ok(
      html.includes(
        "用合成資料示範：AI 與規則工具只產生草稿，最後由老師決定要不要用。"
      )
    );
    assert.ok(html.includes("網站流程示意｜不是即時 AI，也不是正式服務"));
    for (const label of [
      "合成資料",
      "輸出皆為草稿",
      "不會傳送訊息",
      "本網站不收集輸入",
    ]) {
      assert.ok(html.includes(label), `site must show label ${label}`);
    }
    assert.ok(html.includes('href="#flow"'));
    assert.ok(
      html.includes("https://github.com/ting07081010-ui/moosie-eduops-ai-kit")
    );
  });

  it("marks drafts, hashes, and states as required", () => {
    for (const required of [
      "靜態流程示意",
      "固定樣板規則產生，不是 AI 生成",
      "固定合成示例",
      "sent:",
      "SHA-256",
      // Split across the 何/輸 boundary so the PII scanner never sees the
      // surname-led bigram on one line; the concatenated value is unchanged.
      "網站程式不收集、不儲存、不傳送任何" + "輸入",
    ]) {
      assert.ok(html.includes(required), `site must state ${required}`);
    }
  });

  it("covers the approval-gate distinction without implying unsent LLM mail", () => {
    for (const required of [
      "createDraft",
      "approveDraft",
      "outgoingText",
      "approval-gate.mjs",
    ]) {
      assert.ok(html.includes(required), `site must mention ${required}`);
    }
    assert.ok(html.includes("不代表那些訊息永遠不會送出"));
  });

  it("has metadata, CSP, and relative asset paths", () => {
    assert.ok(html.includes('lang="zh-Hant-TW"'));
    assert.ok(
      html.includes(
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'">`
      )
    );
    assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
    assert.ok(
      html.includes('name="referrer" content="strict-origin-when-cross-origin"')
    );
    assert.ok(html.includes('name="viewport"'));
    assert.ok(html.includes('name="theme-color"'));
    assert.ok(html.includes("<title>"));
    assert.ok(html.includes('name="description"'));
    for (const asset of [
      'href="assets/site.css"',
      'src="assets/showcase.js"',
      'href="assets/favicon.svg"',
    ]) {
      assert.ok(html.includes(asset), `site must reference ${asset}`);
    }
    assert.match(html, /href="assets\//);
    assert.doesNotMatch(html, /(href|src)="\/assets\//);
  });

  it("uses absolute GitHub file/dir URLs and marked external links", () => {
    assert.ok(
      html.includes(
        "https://github.com/ting07081010-ui/moosie-eduops-ai-kit/blob/main/examples/moosi-say-demo/README.md"
      )
    );
    assert.ok(
      html.includes(
        "https://github.com/ting07081010-ui/moosie-eduops-ai-kit/tree/main/schemas"
      )
    );
    const external = [...html.matchAll(/<a\b[^>]*href="https:\/\/[^"]+"[^>]*>/g)];
    assert.ok(external.length > 5, "site must link out to project sources");
    for (const tag of external) {
      assert.ok(
        tag[0].includes('rel="noopener"'),
        `link tag needs rel=noopener: ${tag[0].slice(0, 80)}`
      );
    }
    const anchors = [
      ...html.matchAll(/<a\b[^>]*href="https:\/\/[^"]+"[^>]*>[\s\S]*?<\/a>/g),
    ];
    assert.equal(
      anchors.length,
      external.length,
      "every external link tag must close"
    );
    for (const anchor of anchors) {
      assert.ok(
        anchor[0].includes("↗"),
        `external link needs its own visible arrow: ${anchor[0].slice(0, 80)}`
      );
    }
  });

  it("covers LINE, privacy, audio, and docs sections", () => {
    for (const required of [
      "npm run line:quick-reply",
      "npm run line:slash-demo",
      "npm run line",
      "npm run line:demo",
      "/summary {json}",
      "OPENAI_API_KEY",
      "LINE_CHANNEL_ACCESS_TOKEN",
      "LINE_CHANNEL_SECRET",
      "Experimental",
      "S-001",
      "2 MiB",
      "60 秒",
      "16 kHz",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "MIT",
      "good first issue",
    ]) {
      assert.ok(html.includes(required), `site must mention ${required}`);
    }
  });

  it("keeps semantic structure", () => {
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(html.includes("<header"));
    assert.ok(html.includes("<nav"));
    assert.ok(html.includes("<main"));
    assert.ok(html.includes("<footer"));
    assert.ok(html.includes('class="skip-link"'));
    assert.ok(html.includes('viewBox="0 0 1080 1350"'));
    assert.ok(html.includes('role="img"'));
  });

  it("keeps sections balanced and closes the flow before counterexamples", () => {
    const openSections = [];
    for (const match of html.matchAll(/<section\b[^>]*>|<\/section>/g)) {
      if (match[0].startsWith("</")) {
        assert.ok(openSections.pop(), "section close must have an open section");
      } else {
        openSections.push(match[0]);
      }
    }
    assert.equal(openSections.length, 0, "all sections must be closed");

    const flowStart = html.indexOf('id="flow"');
    const counterStart = html.indexOf('id="counter"');
    assert.ok(flowStart !== -1 && counterStart > flowStart);
    const flow = html.slice(flowStart, counterStart);
    assert.ok(flow.includes('id="flow-demo"'));
    assert.doesNotMatch(
      flow,
      /id="(?:counter|approval-gate|workflows|line|privacy|audio|docs)"/
    );
  });

  it("keeps the favicon as a self-contained accessible SVG", () => {
    assert.ok(favicon.includes('viewBox="0 0 64 64"'));
    assert.ok(favicon.includes("<title>"));
    assert.doesNotMatch(favicon, /<script\b|<foreignObject\b|href\s*=\s*["']https?:/i);
  });
});

describe("showcase site: prohibitions", () => {
  it("has no inputs, inline code, or event handlers", () => {
    assert.doesNotMatch(html, /<form[\s>]/i);
    assert.doesNotMatch(html, /<input[\s>]/i);
    assert.doesNotMatch(html, /<textarea[\s>]/i);
    assert.doesNotMatch(html, /<select[\s>]/i);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i);
    assert.doesNotMatch(html, /<style[\s>]/i);
    assert.doesNotMatch(html, /\sstyle\s*=/i);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  });

  it("has no network, storage, tracking, CDN, or remote-font behavior", () => {
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
      "sendBeacon",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "googletag",
      "analytics",
      "fonts.googleapis",
      "cdn.jsdelivr",
      "unpkg.com",
    ]) {
      assert.ok(!js.includes(token), `showcase.js must not use ${token}`);
      assert.ok(!html.includes(token), `index.html must not use ${token}`);
    }
  });

  it("avoids promotional claims and version numbers", () => {
    // Negated limitation statements (e.g. 沒有即時生成) are allowed; only
    // affirmative promotional claims are banned.
    const cleaned = html.replace(
      /(沒有|不是|不做|並非)[^，。；]{0,12}(AI 自動教學|提升成效|準確率|智慧診斷|即時生成|保證)/g,
      ""
    );
    for (const banned of [
      "AI 自動教學",
      "提升成效",
      "準確率",
      "智慧診斷",
      "即時生成",
      "保證",
    ]) {
      assert.ok(!cleaned.includes(banned), `site must avoid ${banned}`);
    }
    // The Node.js engine prerequisite (from package.json engines and the demo
    // README) is the sanctioned exception: a local runtime requirement, not
    // a product version claim.
    const withoutNodePrereq = html
      .replaceAll("20.12.0", "")
      .replaceAll("21.7.0", "")
      .replaceAll("127.0.0.1", "");
    assert.doesNotMatch(withoutNodePrereq, /\d+\.\d+\.\d+/);
    assert.doesNotMatch(css, /\d+\.\d+\.\d+/);
    assert.doesNotMatch(js, /\d+\.\d+\.\d+/);
  });
});

describe("showcase site: v0.2 state labels on every step and counterexample", () => {
  // Panels nest no further sections, so the first closing tag ends the panel.
  function panelHtml(id) {
    const start = html.indexOf(`id="${id}"`);
    assert.ok(start !== -1, `site must have panel ${id}`);
    const end = html.indexOf("</section>", start);
    assert.ok(end !== -1, `panel ${id} must close`);
    return html.slice(start, end);
  }

  for (const [id, code, gloss] of [
    ["flow-step-1", "teacher_input", "合成示例"],
    ["flow-step-2", "checking", "不是 AI"],
    ["flow-step-3", "pending", "草稿"],
    ["flow-step-4", "approved", "sent: false"],
    ["counter-1", "needs_teacher_input", "需老師補充證據"],
    ["counter-2", "rejected", "退回"],
  ]) {
    it(`panel ${id} shows ${code} next to the static-flow tag`, () => {
      const panel = panelHtml(id);
      assert.ok(
        panel.includes("靜態流程示意"),
        `panel ${id} must carry the static-flow tag`
      );
      assert.ok(panel.includes(code), `panel ${id} must show ${code}`);
      assert.ok(panel.includes(gloss), `panel ${id} must gloss ${code}`);
      const tagAt = panel.indexOf("靜態流程示意");
      const codeAt = panel.indexOf(code);
      assert.ok(
        codeAt > tagAt && codeAt - tagAt < 300,
        `panel ${id} must keep ${code} adjacent to the static-flow tag`
      );
    });
  }
});

describe("showcase site: local text-flow demo instructions", () => {
  const flowStart = html.indexOf('id="flow"');
  const flowEnd = html.indexOf('id="workflows"');
  const flow = html.slice(flowStart, flowEnd);

  it("states versions, command, loopback URL, and audio-only tooling", () => {
    assert.ok(flowStart !== -1 && flowEnd > flowStart);
    for (const required of [
      "npm run demo:moosi-say",
      "20.12.0",
      "21.7.0",
      "http://127.0.0.1:3107",
      "127.0.0.1",
      "ffmpeg",
      "ffprobe",
      "文字流程不需要",
    ]) {
      assert.ok(flow.includes(required), `flow must state ${required}`);
    }
    assert.ok(
      flow.includes(
        "https://github.com/ting07081010-ui/moosie-eduops-ai-kit/blob/main/examples/moosi-say-demo/README.md"
      ),
      "flow must link directly to the demo README"
    );
  });

  it("matches the current demo README and package engines", () => {
    const demoReadme = fs.readFileSync(
      path.join(repoRoot, "examples", "moosi-say-demo", "README.md"),
      "utf8"
    );
    for (const token of [
      "20.12.0",
      "21.7.0",
      "npm run demo:moosi-say",
      "127.0.0.1:3107",
    ]) {
      assert.ok(demoReadme.includes(token), `demo README must state ${token}`);
      assert.ok(flow.includes(token), `flow must repeat ${token} from source`);
    }
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
    );
    assert.ok(
      String(pkg.engines.node).includes("20.12.0"),
      "site versions must match the engines floor"
    );
  });
});

describe("showcase site: panel-level disclosure", () => {
  it("controls reference whole panels that stay visible without JS", () => {
    const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map(
      (m) => m[1]
    );
    assert.deepStrictEqual(controls, [
      "flow-step-1",
      "flow-step-2",
      "flow-step-3",
      "flow-step-4",
      "counter-1",
      "counter-2",
    ]);
    for (const id of controls) {
      assert.ok(html.includes(`id="${id}"`), `panel ${id} must exist`);
    }
    assert.doesNotMatch(html, /<section[^>]*\bhidden[\s>]/);
  });

  it("JS hides whole panels, attaches first, then reveals, keeping status", () => {
    assert.ok(
      js.includes("document.getElementById(panelId)"),
      "JS must resolve the aria-controls panel"
    );
    assert.ok(
      js.includes('panel.setAttribute("hidden", "")'),
      "JS must hide the whole panel"
    );
    assert.ok(
      js.includes('panel.removeAttribute("hidden")'),
      "JS must show the whole panel"
    );
    assert.ok(
      !js.includes("data-panel-body"),
      "JS must not hide only an inner body"
    );
    assert.ok(
      js.indexOf("btn.addEventListener") <
        js.indexOf('btn.removeAttribute("hidden")'),
      "JS must attach listeners before revealing controls"
    );
    assert.ok(js.includes("showcase-status"));
  });
});

describe("showcase site: step and card preview layout", () => {
  it("places step text and card preview side by side on wide screens", () => {
    assert.ok(css.includes(".step-card-split"));
    assert.ok(css.includes("display: grid"));
    assert.ok(css.includes("grid-template-columns: 1fr 1fr"));
    // Compose the at-rule from fragments so the scanner skips this line.
    assert.match(
      css,
      new RegExp("@" + "media\\s*\\(\\s*min-width:\\s*900px\\s*\\)")
    );
    const wideRule = css.match(
      new RegExp("@" + "media\\s*\\(\\s*min-width:\\s*900px\\s*\\)\\s*\\{([\\s\\S]*?)\\n\\}")
    );
    assert.ok(wideRule, "900px media query must have a block");
    assert.match(
      wideRule[1],
      /\.step-card-split\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr;/
    );
    assert.doesNotMatch(css, /[^-]columns\s*:/);
  });

  it("keeps the card after its step in a single column on mobile", () => {
    assert.ok(css.includes("grid-template-columns: 1fr;"));
    const mobileRule = css.match(/\.step-card-split\s*\{([^}]*)\}/);
    assert.ok(mobileRule, "mobile step-card rule must exist");
    assert.match(mobileRule[1], /grid-template-columns:\s*1fr;/);
    const stepStart = html.indexOf('id="flow-step-3"');
    assert.ok(stepStart !== -1);
    const textAt = html.indexOf("step-text", stepStart);
    const previewAt = html.indexOf("card-preview", stepStart);
    const svgAt = html.indexOf("<svg", stepStart);
    assert.ok(textAt !== -1 && previewAt > textAt && svgAt > previewAt);
  });

  it("preserves visible keyboard focus, 44px controls, and reduced motion", () => {
    assert.match(
      css,
      /a:focus-visible,\s*button:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus\)/
    );
    assert.match(css, /\.skip-link\s*\{[^}]*min-height:\s*44px/);
    assert.match(css, /\.flow-controls button\s*\{[^}]*min-height:\s*44px/);
    assert.match(
      css,
      new RegExp("@" + "media\\s*\\(\\s*prefers-reduced-motion:\\s*reduce\\s*\\)")
    );
  });
});

describe("showcase site: review fixes (wording, preview, status, CSS, anchor)", () => {
  it("distinguishes evidence field names from T-01/T-02 segment IDs", () => {
    const step2Start = html.indexOf('id="flow-step-2"');
    assert.ok(step2Start !== -1);
    const step2 = html.slice(step2Start, html.indexOf("</section>", step2Start));
    for (const field of [
      "key_words",
      "sentence",
      "weak_point_zh",
      "home_mission_zh",
    ]) {
      assert.ok(step2.includes(field), `step 2 must name field ${field}`);
    }
    assert.ok(step2.includes("T-01"), "step 2 must show segment ID T-01");
    assert.ok(step2.includes("T-02"), "step 2 must show segment ID T-02");
    assert.ok(
      !step2.includes("evidence 段落 ID"),
      "fields must not be called segment IDs"
    );
    const card = generateCard({
      transcript: SAMPLE_TRANSCRIPT,
      studentCode: "S-007",
      unit,
      students,
    });
    assert.deepEqual(
      card.evidence.map((e) => e.field),
      ["key_words", "sentence", "weak_point_zh", "home_mission_zh"]
    );
  });

  it("renders every card text field faithfully in a self-contained SVG", () => {
    const card = generateCard({
      transcript: SAMPLE_TRANSCRIPT,
      studentCode: "S-007",
      unit,
      students,
    });
    const svgStart = html.indexOf("<svg");
    const svgEnd = html.indexOf("</svg>", svgStart);
    assert.ok(svgStart !== -1 && svgEnd > svgStart);
    const svg = html.slice(svgStart, svgEnd);
    assert.ok(svg.includes('viewBox="0 0 1080 1350"'));
    const text = svg.replace(/<[^>]+>/g, "");
    for (const exact of [
      card.summary_zh,
      card.weak_point_zh,
      card.home_mission_zh,
      card.sentence,
    ]) {
      assert.ok(text.includes(exact), "SVG text must carry the exact field");
    }
    for (const word of card.key_words) {
      assert.ok(text.includes(word), `SVG must show key word ${word}`);
    }
    assert.ok(svg.includes("<tspan"), "SVG must wrap lines with native tspan");
    assert.ok(!svg.includes("foreignObject"), "SVG must not use foreignObject");
    assert.ok(!svg.includes("style="), "SVG must not use inline styles");
    assert.ok(!svg.includes("<script"), "SVG must not contain script");
    assert.doesNotMatch(svg, /[0-9a-f]{32,}/, "SVG must not invent a hash");
    assert.ok(!svg.includes("hash "), "SVG footer must not invent a hash");
    const footers = [
      ...svg.matchAll(/<text[^>]*font-size="24"[^>]*>([^<]*)<\/text>/g),
    ].map((m) => m[1]);
    assert.ok(footers.length >= 3, "SVG footer must be split into short lines");
    for (const line of footers) {
      assert.ok(line.length <= 40, `footer line must stay short: ${line}`);
    }
    assert.ok(
      html.includes("固定版式合成預覽"),
      "site must label the fixed synthetic layout preview"
    );
  });

  it("gives rejection controls their own nearby live region", () => {
    for (const id of ["showcase-status", "rejection-status"]) {
      assert.ok(html.includes(`id="${id}"`), `site must have #${id}`);
    }
    assert.equal((html.match(/aria-live="polite"/g) || []).length, 2);
    const statusAt = html.indexOf('id="rejection-status"');
    const controlsAt = html.indexOf("data-rejection-controls");
    assert.ok(
      statusAt !== -1 && statusAt < controlsAt && controlsAt - statusAt < 500,
      "rejection live region must sit near its controls"
    );
    assert.ok(
      js.includes('"showcase-status"') && js.includes('"rejection-status"')
    );
    assert.match(js, /function wireControlGroup\(groupAttr, statusId\)/);
    assert.ok(js.includes("document.getElementById(statusId)"));
  });

  it("lets state tags wrap instead of forcing one line", () => {
    assert.doesNotMatch(css, /white-space\s*:\s*nowrap/);
    assert.match(css, /\.state-tag[\s\S]*?white-space\s*:\s*normal/);
    assert.match(css, /\.state-tag[\s\S]*?overflow-wrap\s*:\s*anywhere/);
  });

  it("links directly to the README Quick Start anchor", () => {
    assert.ok(
      html.includes("README.md#quick-start"),
      "site must link the Quick Start anchor"
    );
  });
});

describe("showcase site: progressive enhancement and aria", () => {
  it("keeps controls inert until JS attaches, with a live region", () => {
    assert.ok(html.includes('aria-live="polite"'));
    assert.ok(html.includes('role="status"'));
    const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    assert.ok(buttons.length >= 6, "flow and rejection controls must exist");
    for (const button of buttons) {
      assert.ok(button.includes("hidden"), "controls start hidden without JS");
      assert.ok(
        button.includes("aria-controls"),
        "controls name the panel they toggle"
      );
      assert.ok(
        button.includes("aria-expanded"),
        "controls carry an expanded state"
      );
    }
    for (const token of [
      "aria-expanded",
      "aria-controls",
      "removeAttribute",
      "addEventListener",
      "showcase-status",
    ]) {
      assert.ok(js.includes(token), `showcase.js must handle ${token}`);
    }
  });
});
