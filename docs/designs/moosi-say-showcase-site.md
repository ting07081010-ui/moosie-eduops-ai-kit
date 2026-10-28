# Moosie EduOps AI Kit／Moosi 說展示網站設計規格（v0.2，已批准實作）

- **狀態：** v0.2 已由專案負責人批准實作（取代 v0.1 草案；v0.1 內文已過時，僅保留文件目的說明）。
- **日期：** 2026-10-28
- **產品語言：** 繁體中文（台灣）
- **來源專案：** [ting07081010-ui/moosie-eduops-ai-kit](https://github.com/ting07081010-ui/moosie-eduops-ai-kit)
- **實作範圍（僅允許）：** 更新本文件；新建 `site/index.html`、`site/assets/site.css`、`site/assets/showcase.js`、`site/assets/favicon.svg`、`test/showcase-site.test.mjs`。不得修改其他檔案（特別是 `README.md`、`package.json`、既有 demo、資料／schema／API／provider 行為、workflow、分支、PR、遠端或部署設定）。不 commit、不 push、不合併、不開／改 PR、不部署、不新增套件或建置步驟。

## 目的（自 v0.1 保留）

建立一個單頁、靜態、繁體中文專案導覽網站，讓小型補教團隊、老師、教育工作者及開源評閱者快速理解 Moosie EduOps AI Kit 的用途，並以 Moosi 說的課後英語學習圖卡流程作為主要視覺案例。網站是專案導覽與流程解說，不是新的教務產品、正式服務或線上 AI 生成工具。

## v0.2 決策記事（未定事項的採用值）

1. **Demo 連結：** 網站內的 Moosi 說 demo CTA 直接連到 Moosi 說 demo README（`examples/moosi-say-demo/README.md` 的 GitHub 絕對網址），不經由根 README 轉跳；本次不編輯根 `README.md`。
2. **測試策略：** 測試使用 Node 內建 `node:test`，直接讀取原始碼與資料檔並比對「原始來源文字」（exact source-backed text），不另行維護一份轉譯後的快照檔。
3. **搜尋索引：** 在部署另行批准之前，網站預設 `<meta name="robots" content="noindex, nofollow">`，並在本文件記錄此決定；本次不做任何部署變更。

## 產品故事與定位

- 單頁靜態網站，mobile-first，繁體中文（台灣），`html lang="zh-Hant-TW"`。
- 專案定位：開源 Moosie EduOps AI Kit 是參考工具組／專案指南，不是通用家教 app、校務管理系統、正式生產服務或線上 AI 生成工具。
- 明確區分工具組與其離線規則式 Moosi 說 demo。
- 不顯示版本號、效能數字、準確率或使用者數量；避免「AI 自動教學」「保證」「提升成效」「準確率」「智慧診斷」「即時生成」等宣傳用語。

Hero：品牌「Moosie EduOps AI Kit」；副標必須一字不差為「用合成資料示範：AI 與規則工具只產生草稿，最後由老師決定要不要用。」；文字／圖示標籤：合成資料、輸出皆為草稿、不會傳送訊息、本網站不收集輸入；CTA「看 Moosi 說流程」連到 `#flow`，「查看 GitHub 專案」連到 repo。接著一段定位文字：可重用的 prompts、JSON schemas、合成資料、CLI／LINE demo、evals、隱私處理模式；早期、可在本機執行的參考專案，不是完整產品。

## Moosi 說流程（固定合成案例）

採用實際來源的單一固定案例：S-007、暱稱 Sunny、Beginner、Unit 5、weakWords `["grapes"]`（明確標示為虛構 fixture 欄位，不是診斷或模型推論）；白名單 apple、banana、grapes；句型 `I want some {fruit}, please.`。逐字稿與錯誤字串必須逐字取自 `examples/moosi-say-demo/lib/moosi-say.mjs`，實作前先驗證原始碼現況。

成功固定逐字稿（即 `SAMPLE_TRANSCRIPT`）：

```text
S-007 在 Unit 5 水果課上能說出 apple 和 banana，grapes 的字首 g 還需要多練習。
請媽媽在家陪 S-007 玩買水果遊戲，練習說 I want some grapes, please。
```

四個有序步驟：合成老師紀錄；規則檢查（白名單、弱詞須來自所選學生的 fixture 且同一分句有明確練習提示、圖卡每一個欄位（`key_words`、`sentence`、`weak_point_zh`、`home_mission_zh`）都要有對應 evidence，其段落 ID 如 `T-01`、`T-02`，欄位名稱與段落 ID 分開表述）；4:5 SVG 圖卡草稿（viewBox `1080x1350`，明確標示「固定樣板規則產生，不是 AI 生成」，提及 demo 會計算 SHA-256 內容雜湊但不得虛構雜湊值；SVG 須完整呈現 `generateCard` 的 `summary_zh`、`key_words`、`sentence`、`weak_point_zh`、`home_mission_zh` 欄位原文，只用原生 `text`／`tspan` 換行排版，不用 `foreignObject`、內嵌樣式或 script，不列雜湊值，頁尾拆成短行且不超出 viewBox，並標示為固定版式合成預覽）；人工核准（老師／管理員身份，後端比對當前雜湊；缺失／不符雜湊、需補證據、重複核准均拒絕；核准只改變本機草稿，`sent:false`，不傳送給家長）。各步驟標題旁並列「靜態流程示意」與狀態標籤：步驟一 `teacher_input`（合成示例）；步驟二 `checking`（規則比對，不是 AI）；步驟三 `pending`（草稿）；步驟四 `approved`（`sent:false`，不會傳送）。狀態標籤（`.state-tag`）允許換行（含長代碼可斷行），保持標籤相鄰可讀。

本機操作文字流程的方式（詳見 demo README）：需要 Node.js `20.12.0+`（Node 20）、`21.7.0+`（Node 21）或 Node 22+；執行 `npm run demo:moosi-say` 後開啟 `http://127.0.0.1:3107`（預設只綁定 loopback）。`ffmpeg` 與 `ffprobe` 只在音訊功能需要，打字文字流程不需要。此段放在流程區內，並直接連結 demo README。

兩個固定反例（皆取自 demo 程式碼／輸出，不得改寫或意譯）：

1. 證據不足：逐字稿包含全部單元單字，但對 grapes 沒有明確練習提示；狀態 `needs_teacher_input`，顯示 demo 原文老師可讀訊息，不產生圖卡／雜湊／可核准物件，請老師補充證據後重新產生。現行原始碼的預期錯誤之一為「逐字稿沒有明確記錄名冊弱詞（grapes）需要練習；已交回老師補充觀察後再產生圖卡。」。
2. 超綱單字 orange：顯示 demo 原文錯誤訊息，狀態 rejected／退回，不產生圖卡。現行原始碼的預期錯誤之一為「紀錄中有本單元以外的英文單字（orange），已退回，不會產生圖卡。」。

兩個反例標題旁同樣並列「靜態流程示意」與狀態標籤：證據不足者 `needs_teacher_input`（需老師補充證據）；超綱單字者 `rejected`（退回）。

區分說明面板：其他 LLM 工作流使用 `src/core/approval-gate.mjs` 的 `createDraft` → `approveDraft` → `outgoingText`；需人類老師／管理員核准；`riskVerdict` 為 block 時阻止核准。這與 Moosi 說規則式雜湊綁定本機核准不同。連到 GitHub 原始碼，不得暗示那些已核准 LLM 訊息永遠不會送出；已設定的 provider／其他工作流是不同路徑。

互動：全部內容、步驟、反例與安全標籤在停用 JS 時仍完整可讀；預設 CSS 不得隱藏核心文字。僅做漸進增強：外部 JS 成功掛載處理器前，步驟／反例控制項保持隱藏且 inert；掛載後啟用無障礙原生 disclosure 控制並收合非使用中面板。使用 `aria-expanded`／`aria-controls` 與兩個就近的 `aria-live="polite"` 狀態區（`#showcase-status` 管流程控制，`#rejection-status` 管反例控制；`wireControlGroup` 取狀態區 ID）；鍵盤可操作；無 JS 頁面不得出現無作用按鈕。不做動態產生、輸入、URL state、追蹤或網路行為。雜湊導覽可有可無；不用 cookie 或 Web Storage。固定橫幅：「網站流程示意｜不是即時 AI，也不是正式服務」。

## 其他區塊

- 工作流卡片：一句事實描述＋連結；狀態沿用 repo 自述（Stable／Experimental）：老師筆記轉結構化紀錄、每週家長摘要、家長訊息隱私／風險檢查、行政任務擷取、prompt evals、JSON schemas、批次處理。不宣稱產品化。
- LINE 區：兩個不可互換的伺服器：quick reply 用 `npm run line:quick-reply`（舊名 `npm run line` 別名），一般文字＋5 個 quick reply；slash demo 用 `npm run line:slash-demo`（舊名 `npm run line:demo` 別名），`/summary {json}`、`/risk <text>`、`/task {json}`。標示 Experimental、本機限定、需 `.env` 設定 `OPENAI_API_KEY`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`；網站本身不連 LINE。以來源為準。
- 隱私：標籤為合成資料、草稿、人工審核，以及網站實際刊出的不收集、不儲存、不傳送使用者鍵入內容之完整宣告（以網站文字為準）；註腳說明託管方可能依其政策保留一般存取紀錄，外部連結遵循目標政策。說明其他 LLM 工作流會把內容送到設定的 provider（Claude 或 OpenAI）；先去識別化（例如 S-001；不送姓名、電話、地址、學校、家長聯絡方式）並檢視 provider 條款。不把 Moosi 說離線狀態外推到全部流程。聲明不是法律／合規保證；部署負責人負責同意、保留與在地法律意見。
- 音訊：純文字說明，無上傳 UI 或音訊控制：合成 Ogg／Opus 音調、本機 ffmpeg 正規化為 16 kHz mono PCM16 WAV、固定 mock 逐字稿與音訊無關（不是語音辨識）、上限 2 MiB／60 秒；合成／成人老師聲明不是身份或來源驗證；粗體警告禁用真人／兒童錄音。音訊工具是額外需求；純文字 demo 不需要。
- 文件：GitHub 專案、根 README（含直達 `README.md#quick-start` 的 Quick Start 連結）、Quick Start、`CONTRIBUTING.md`、`SECURITY.md`（安全問題回報）、good-first-issue、MIT 授權、隱私文件；demo CTA 直接到 `examples/moosi-say-demo/README.md`。每個外部連結各自附可見 ↗ 標示。檔案用絕對網址 `https://github.com/ting07081010-ui/moosie-eduops-ai-kit/blob/main/...`，目錄用 `/tree/main/...`（Pages 產物只有 `site/`）。站內資產用相對網址如 `assets/site.css`；不用根開頭資產網址。外部連結用 `rel="noopener"` 與可見 ↗ 標示。

## 技術／安全

- 純靜態 HTML／CSS／原生 JS（ES2020），無建置、無新依賴、無伺服器、無 API／LLM／LINE 呼叫、無 form／input／textarea／檔案選擇、無驗證、無 cookie／儲存／分析、無第三方字型／CDN／外部圖片、無兒童照片。只用 CSS 或自含向量圖形；不遠端載入資產。
- 外部本機資產：`assets/site.css`、`assets/showcase.js`、本機 SVG favicon。CSP meta 必須一字不差：`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'`。無內嵌 script、事件處理器、style 標籤或 style 屬性。加 referrer policy `strict-origin-when-cross-origin`、title、meta description、viewport、theme-color。無外部 Open Graph 圖片。部署另行批准前用 robots `noindex, nofollow` 並在本文件記錄；本次不授權部署。
- Mobile-first：360px 單欄；768px 兩欄摘要；≥900px 流程／圖卡並排。無橫向溢位。語意化 header／nav／main／section／footer、skip link、單一 h1、有序標題層級。SVG 圖卡 `role="img"` 含 title＋desc（包括「固定合成示例」）。可見焦點、最小 24x24 目標（建議 44x44）；不用顏色單獨傳達狀態；支援 reduced-motion。偏好 disclosure 而非 tabs。
- CSS token：主色 `#2f6b4f`、背景 `#f4f1ea`、白色內容卡、文字約 `#1f2a24`（淺底對比 ≥4.5:1）、琥珀色提示只用背景／邊框、不用琥珀色文字。系統字型優先繁中可讀。溫暖清楚的教育工具風；無真實學生圖像。

## 驗收與測試

- 只新增 `test/showcase-site.test.mjs`，用 Node 內建 `node:test` 讀取原始碼／資料檔：檢查固定 fixture／句型／逐字稿與錯誤訊息／來源支撐反例；必要文案／標籤／連結（含每個外部連結各自的 ↗、直達 `README.md#quick-start`）／CSP／metadata／相對路徑；證據欄位名與 `T-01`／`T-02` 段落 ID 區分；SVG 完整欄位原文、原生 `text`／`tspan`、短行頁尾、無雜湊值；兩個就近狀態區與 `wireControlGroup` 狀態區 ID；`.state-tag` 可換行；無 form／input／textarea／檔案輸入；無內嵌 script／style／on-事件屬性；無網路 API（fetch、XMLHttpRequest、WebSocket、EventSource、sendBeacon）、儲存／cookie／分析／CDN／遠端字型；漸進增強互動；必要 aria 狀態／live region；無禁用宣傳用語；無版本號。不新增依賴。測試檔僅為原始碼／Node 字串檢查，不證明瀏覽器呈現、螢幕報讀或人工驗收。
- 驗證命令（不因無關檔案失敗而修無關檔案）：`npm test`、`npm run eval:structural`、`npm run scan`、`git diff --check`。不修改 `package.json` 或其他檔案。`AGENTS.md` 保持原樣。不 commit／push／合併／切分支／PR／部署。回報變更檔案清單與測試摘要即可。

## 來源文件

- [專案 README](../../README.md)
- [隱私政策](../../PRIVACY.md)
- [架構說明](../architecture.md)
- [展示腳本](../demo-script.md)
- [未成年人隱私指南](../privacy-and-minors.md)
- [Moosi 說離線 demo 操作與限制](../../examples/moosi-say-demo/README.md)
- [Moosi 說 demo 核心規則](../../examples/moosi-say-demo/lib/moosi-say.mjs)
- [核准閘門](../../src/core/approval-gate.mjs)
- [Moosi 說假學生名冊](../../examples/moosi-say-demo/data/students.json)
- [Unit 5 水果單元](../../examples/moosi-say-demo/data/unit5.json)
- [LINE slash-command demo](../../examples/line-webhook-demo/README.md)
- [npm scripts 與既有驗證命令](../../package.json)
