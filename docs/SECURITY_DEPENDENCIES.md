# 安全、依賴與授權

本文件區分 **IMPLEMENTED** 防護與 **PLANNED／OPTIONAL** 改善；描述現況不代表保證無漏洞或無法律風險。

## IMPLEMENTED：執行期與工具依賴

| 依賴 | 版本／來源 | 用途／必要性 |
| --- | --- | --- |
| Browser JavaScript、HTML、CSS | Web 平台 API；未訂定完整最低瀏覽器矩陣 | 自製 Canvas 2D 遊戲；沒有 React／Phaser／Unity |
| Canvas 2D、Web Audio、Pointer Events、WebRTC | 瀏覽器提供，不是 npm package | 繪圖、聲音、觸控、雙人直連 |
| PeerJS | 1.5.5，`vendor/peerjs-1.5.5.js` | runtime，只有線上模式必須；vendored 並內嵌，不走 CDN |
| Python | 維護基線 3.11+；審核環境 3.12.14 | build／檢查／測試編排，標準函式庫；不在瀏覽器運行 |
| Node.js | 維護基線 22+；審核環境 24.19.0 | JavaScript VM／語法／unit tests；不作 runtime server |
| Python Playwright | 測試工具 1.62.0 | dev，瀏覽器 smoke；安裝與 pin 以 [TESTING](TESTING.md) 為準 |
| Chromium | 審核環境 151.0.7922.173 | dev，實際瀏覽器測試；不是承諾使用者必須用此版 |
| Git／GitHub CLI | 工具版本依環境 | 版本管理與可選唯讀發布診斷；`gh` 不是遊戲依賴 |

沒有 package manager runtime 安裝流程；不要在此 repo 直接 `npm update`，也不要把 PeerJS 上游的 Parcel／TypeScript 開發環境誤當成遊戲的 stack。套件工具只因有具體用途才加入。

### PeerJS 來源與 license

現有 vendor：86,912 bytes，SHA256 `63802d53d564378eba2aa98f6a2580f072293d0ded3e5a4adf9e8bc59bcd2329`；bundle 含版本字串 `1.5.5`。MIT copyright／permission 原文已保留在 `src/shell.html` 並發行到 `index.html`。

[PeerJS v1.5.5 官方 package.json](https://github.com/peers/peerjs/blob/v1.5.5/package.json) 宣告 MIT，以及 `@msgpack/msgpack ^2.8.0`、`eventemitter3 ^4.0.7`、`peerjs-js-binarypack ^2.1.0`、`webrtc-adapter ^9.0.0`。這些是上游宣告範圍，**不是本 repository 已重建驗證的 bundle 內部精確版本**。現有 minified bundle 缺原始 lockfile／完整內部 notice 溯源；完整 transitive notice audit 仍是技術債。不要因主套件 MIT 就宣稱所有素材和依賴均已取得商用權。

整個遊戲與使用者音樂沒有已授予的開源 license；PeerJS MIT 只適用其程式。此任務不替作者選擇專案授權。素材來源與未來記錄規範見 [ASSET_PIPELINE](ASSET_PIPELINE.md)。

### PLANNED：依賴更新方式

每次更新一個有原因的依賴：記錄修復／風險 → 從官方 release 取得固定版本 → 核對 hash、上游 license、傳遞 notices → 替換 vendor 並更新 build 對應路徑 → 重建 → transport／authority／音訊／瀏覽器回歸 → 真實兩裝置連線 → 更新本表與 CHANGELOG。不要把 `latest` 遠端 `<script>` 放回遊戲。重大 API／網路預設改變先補 ADR。

**OPTIONAL**：未來真的引入 package manager 才提交其 lockfile、設置自動更新；目前用 vendored snapshot 與明確版本，無需為了掃描工具建立假的 package.json。

## IMPLEMENTED：資料與信任邊界

- 遊戲沒有帳號、伺服器儲存、支付、分析 API 或私密 runtime key；不需 `.env.example`。所有發行到瀏覽器的 JS、data URL 和設定都可被讀取。
- `localStorage` 目前只存教學完成 lesson ID，不能視為可信身份、支付／成就證據或安全保管區。資料模型與未來 migration 見 [SAVE_SYSTEM](SAVE_SYSTEM.md)。
- `?room=` 只預填 input，不自動加入；`RiftNet._normalizeCode` 驗證 6–12 位英數房碼。使用 `textContent` 顯示狀態，不能將對方資料拼成 `innerHTML` 或 executable code。
- PeerJS 使用公用信令 `0.peerjs.com`。bundle 預設含 Google STUN 和 PeerJS eu/us TURN；本遊戲沒有自有、可承諾容量的中繼。那些是 vendor 公開預設設定，不是 repository 私有 credential。連線會與信令／ICE 服務及對手交換必要網路資訊，不能稱完全離線或匿名。
- `RiftNet` cleanJSON 重新建立 JSON tree，限制封包結構、深度、長度、數值、敏感 prototype keys；每秒最多 300 收包，過度 bufferedAmount 中斷。入房 metadata 核對 `game='riftblade'`（遊戲識別）與 `v=5`（protocol version），封包也驗證協議版本；**不比對 runtime `4.2.0`、move 定義或 content hash**。
- `src/authority.js` 再核對戰鬥行為。防守方裁決是手感／權限設計，**不是防作弊保障**：雙方均持有完整程式與 `game.debug`，可修改自己 runtime。適合信任型好友對局，沒有 authoritative server 或競技排名驗證。
- 房號不是認證或密碼；目前不提供反觀戰／身份驗證／可靠秘密房間保證。不要放敏感資料進封包、房號、URL 或錯誤訊息。

## 開發與發布規則

不要提交 API key、PAT、私鑰、真正 `.env`、登入 cookie 或工作階段憑證。使用平台既有安全 credential provider／Git auth；不要要求使用者把 token 貼到聊天。日誌只記狀態、錯誤類型與 hash，不列 process environment、Authorization header、音樂 data URL 或完整遠端資料。

若 credential 曾公開，應由持有人撤銷／輪換；「沒寫入檔案」不能恢復其機密性。若進入 Git 歷史，先撤銷，再另行規劃清理歷史，不可為本任務擅自 force push。CI 使用最低必要權限；本次驗證工作流程不需要個人 token。

**PLANNED**：需要自有 TURN 時，長效私密金鑰不能內嵌在單檔。應由受控後端核發短效 TURN credential，定義速率限制、服務成本與私隱告知，再加環境變數範本（只有 key 名與安全例值）。

**PLANNED**：新增 Boss／move 或調整判定資料時，先檢查雙端內容相容性。現有 `v=5` 相同不能保證兩個不同遊戲 revision 能正確對決；改變封包語義或不能相容的戰鬥契約時應提升 protocol version，或先導入明確的 content compatibility handshake，再做新舊版本互連拒絕測試。不能只提升 UI 顯示版本便宣稱舊客戶端會被擋下。

**OPTIONAL**：正式競技／多人持久世界才評估伺服器裁決、身份驗證、反濫用。CSP 能降低未來注入風險，但目前單檔含 inline script/style、data audio、WebSocket/WebRTC；新增 CSP 必須明列允許來源並在真實瀏覽器測試，不能貼上通用 policy 導致遊戲失效。
