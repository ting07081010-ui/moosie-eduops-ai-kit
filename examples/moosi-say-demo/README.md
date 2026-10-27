# Moosi 說 · 離線示範 (Offline Demo)

老師課後文字紀錄 → 課綱限定學習圖卡草稿 → 老師預覽 → 綁定內容雜湊的明確核准。
也可接收**自行生成的合成 Ogg/Opus 測試音訊**，先在本機標準化，再由注入的 mock provider 回傳固定範例逐字稿供編輯。

**音訊標準化是真的；逐字稿是固定模擬，不是語音辨識，也不代表音訊內容。核准只更新本地草稿狀態，不會傳送給家長。**
全程 synthetic 假資料，執行此 demo 不會呼叫外部模型、WhatsApp 或付費 API。

## 執行

需要 Node.js、專案相依套件；音訊功能另需 PATH 中有本機 `ffmpeg` 與 `ffprobe`。

```bash
npm install
ffmpeg -version
ffprobe -version
npm run demo:moosi-say
# 開啟 http://127.0.0.1:3107
```

預設只綁定 `127.0.0.1`。直接執行時 `HOST` 只允許 `127.0.0.1`、`::1` 或 `localhost`；其他值會拒絕啟動。
`PORT` 可覆寫。這不是部署或正式服務；沒有生產環境身份驗證。

## 操作流程

1. 從名單選擇假學生代號（如 `S-007`），不輸入真實姓名。
2. 使用打字逐字稿，或按「載入水果課範例」。也可依下節生成合成音檔後，選檔並明確勾選 synthetic／adult-teacher 聲明，再按本機正規化按鈕。
3. 音訊入口只會回傳**固定模擬**逐字稿與 WAV 格式資訊，不會自動產生草稿。老師先確認、編輯文字。
4. 按「產生草稿預覽」查看 4:5 SVG（viewBox `1080x1350`）、卡片 JSON 與 SHA-256 內容雜湊。
5. 選擇老師／管理員身份，再按「核准此版本」。後端比對當前卡片雜湊；缺失、不符、被阻擋與重複核准均拒絕。

變更學生、文字、音檔或載入範例會使舊預覽失效；上傳開始即停用舊核准，過時的上傳回應不會覆蓋已編輯文字。
沒有麥克風錄音功能。**不得選取或上傳真人錄音，尤其不得使用兒童音訊。**

## 合成音訊與本機 API

只收 raw bytes，不接 multipart、檔案路徑或遠端 URL：

```text
POST /api/voice/transcribe
Content-Type: audio/ogg  （或 application/ogg）
X-Demo-Synthetic: true
X-Input-Role: adult-teacher
```

限制與實際處理：

- 輸入上限 **2 MiB**、最多 **60 秒**、單一 Ogg/Opus 音訊串流。副檔名及 MIME 不足以通過驗證；先檢查 Ogg signature，再由 ffprobe 檢查容器、編碼與串流。
- ffprobe／ffmpeg 只允許 `pipe` protocol、固定參數與 `shell:false`；每個子程序最多 15 秒，stdout 與 stderr 均有大小限制。
- ffmpeg 輸出 **16 kHz、mono、signed 16-bit little-endian PCM**；程式加上長度正確的 WAV header，並重新驗證 RIFF、fmt、data 及樣本對齊。
- stdin 探測可能沒有 duration；解碼樣本數才是最終時間判斷。為偵測超時可多解碼少量邊界，但超過 60 秒一律拒絕，不會截短後假裝成功。
- Buffer／pipe 在記憶體內處理；應用程式不寫入、快取、記錄或回傳音訊。回應只有文字、mock provenance、格式資訊與 `sendsMessages:false`。
- mock provider 必須明確回報 `transcriptionIsMock:true`、有效文字及 provenance；缺少、失敗、格式錯誤或逾時均拒絕。預設 provider 永遠回傳相同 `SAMPLE_TRANSCRIPT`，與音訊內容無關，最多等待 5 秒。
- 格式／聲明錯誤回 JSON 4xx，超量 413，超時或工具／provider 問題回安全 JSON 5xx，不洩漏內部 stderr、路徑或 stack。

聲明標頭只是此 demo 的明確使用限制，**不是身份或合成來源驗證**。不得將這個入口用於真實錄音或公開網路。

### 產生測試檔並用 UI 選取

以下只生成 48 kHz 立體聲合成音調，不含人聲：

```bash
ffmpeg -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=1' \
  -ac 2 -c:a libopus -f ogg /tmp/moosi-synthetic-tone.ogg
```

### 不落地的合成音訊上傳範例

先啟動本機 demo，再在另一個 terminal 執行：

```bash
ffmpeg -v error -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=1' \
  -ac 2 -c:a libopus -f ogg pipe:1 | \
curl -sS http://127.0.0.1:3107/api/voice/transcribe \
  -H 'Content-Type: audio/ogg' \
  -H 'X-Demo-Synthetic: true' \
  -H 'X-Input-Role: adult-teacher' \
  --data-binary @-
```

回應的水果課文字是 mock 固定範例，**不是上面音調的轉錄**。
音訊選項參見 [FFmpeg 官方文件](https://ffmpeg.org/ffmpeg.html) 與 [官方 resampler 文件](https://ffmpeg.org/ffmpeg-resampler.html)。

## 課綱與人工核准關卡

- `data/students.json` 是 3 位假學生；`data/unit5.json` 是示範用 Unit 5 水果課白名單：`apple, banana, grapes`，句型 `I want some {fruit}, please.`。
- 圖卡用固定樣板規則生成，**不是 AI 生成**；逐字稿英文須在白名單內，超綱（如 orange）直接退回，每個欄位需有 `evidence` 段落 ID，不編造缺失依據。
- 核准時重新計算卡片內容 SHA-256；回傳物件採深拷貝，外部竄改不能繞過核准。`sent` 永遠為 `false`，不會實際發送。
- 只有 SVG／HTML 預覽，沒有 PNG 匯出；吉祥物是佔位圖形，沒有真實兒童圖像。

## 離線測試與檢查

```bash
node --test test/moosi-say-audio.test.mjs test/moosi-say-demo.test.mjs
npm test
npm run eval:structural
npm run scan
git diff --check
```

音訊測試在記憶體內生成合成音調，實際驗證 ffmpeg 的 48 kHz 立體聲 Opus → 16 kHz mono PCM16 WAV；也涵蓋錯誤格式、串流、大小／時間界線、子程序失敗／逾時／輸出限制、mock provider 契約、安全 JSON HTTP 錯誤與既有 hash-bound 核准。
HTTP 測試只使用 `127.0.0.1` 的暫時 port；不接外部網路，不保存音訊 fixture，不跑 live eval。

## 尚未實作

真實語音辨識、Meta 模型串接、WhatsApp 媒體下載／webhook／簽章／發送、PNG 合成、正式身份驗證、家長按鈕回寫與看板均不在此階段。
需要另行核准才能動用外部付費 API、真實聯絡資料或部署；本階段沒有這些行為。
