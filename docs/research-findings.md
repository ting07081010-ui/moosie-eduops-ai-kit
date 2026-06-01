# 研究發現：可借鑑的開源專案

## 1. Claw-ED — 最相關
**Repo:** github.com/SirhanMacx/Claw-ED
**Stars:** 活躍開發中 | **License:** MIT

### 做法
- **12-check quality gate + auto-retry**：每個 lesson 經過 12 項教學檢查（Bloom's progression、stimulus-based assessment、differentiation specificity、diversity audit），失敗自動重試
- **AI-ism removal**：自動移除 LLM 常見用語（"delve"、"utilize"、"leverage" 等 70+ 詞），讓輸出像老師寫的
- **soul.md 風格學習**：從老師的舊教材中學習教學風格，存在 soul.md
- **Classroom memory**：persistent profile（學生人數、ELL/IEP 需求、可用設備）注入每次生成
- **Local-first privacy**：所有資料在本地，不外傳
- **Central approval policy**：每個 tool 按風險分級（read_only/write_local/network_call/package_install）

### 可複製到 Moosie
- ✅ Quality gate 概念 → 我們已有 risk check，可擴充為 multi-check
- ✅ AI-ism removal → 加入 parent-weekly-summary prompt
- ✅ Classroom memory → 注入 student profile 到 prompt context
- ✅ Approval policy → 任務按風險分級

## 2. SmartAssign — Human-in-the-Loop 標竿
**Repo:** github.com/ladHarsh/SmartAssign

### 做法
- **"Decision-support system, not autonomous grader"**：所有 AI 輸出標記為 "draft"
- **Low temperature (0.1-0.2)**：優先事實一致性
- **Clean pipeline**：PDF → Text Extraction → LLM → Structured JSON → Instructor Review
- **Avoids accuracy claims**：評估用一致性、對齊度、時間節省

### 可複製到 Moosie
- ✅ 所有輸出標記為 draft → 已有 riskStatus
- ✅ Low temperature → 我們用 0.3，可降到 0.2
- ✅ Pipeline 清晰度 → 強化文件

## 3. MUJINN/ai-question — 兩階段管線
**Repo:** github.com/MUJINN/ai-question

### 做法
- **Generation + Validation 兩階段**：一個模型生成，另一個模型驗證
- **Quality scoring**：多維度品質評分
- **Retry when quality too low**：品質不夠自動重試
- **Separate prompts**：生成和驗證用不同 prompt

### 可複製到 Moosie
- ✅ 我們已有 callLLMJsonValidated (retry on schema failure)
- 🔄 可加：quality scoring before output

## 4. promptfoo — Eval 框架標竿
**Repo:** github.com/promptfoo/promptfoo (now part of OpenAI)

### 做法
- **Declarative eval configs**：YAML 定義 test cases
- **CI/CD integration**：PR 時自動跑 eval
- **Local-first**：eval 100% 在本地跑
- **Red teaming**：自動漏洞掃描

### 可複製到 Moosie
- ✅ 我們已有 structural eval + CI
- 🔄 可加：declarative YAML config format
- 🔄 可加：red teaming for education prompts

## 總結：優化優先序

| # | 優化項目 | 來源 | 難度 |
|---|---------|------|------|
| 1 | AI-ism removal in prompts | Claw-ED | 低 |
| 2 | Quality gate with multi-check | Claw-ED + ai-question | 中 |
| 3 | Classroom memory injection | Claw-ED | 低 |
| 4 | Temperature降到0.2 | SmartAssign | 極低 |
| 5 | Declarative eval config | promptfoo | 中 |
| 6 | Task risk grading | Claw-ED | 低 |
