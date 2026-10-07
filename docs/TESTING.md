# 測試策略與執行

**IMPLEMENTED**：repository 內含可獨立執行的 Node 合約／模擬測試與 Chromium smoke；沒有 npm、外部工作目錄或雲端私有 helper 依賴。**PLANNED**：新系統加入時才建立 stats、inventory、save migration、stage transition 測試；目前不能宣稱這些系統已通過測試。每次交付的實際結果見 [VALIDATION](VALIDATION.md)，手動檢查見 [REGRESSION_CHECKLIST](REGRESSION_CHECKLIST.md)。

## 快速執行

需求：Python 3.11+、Node.js 22+。在 repository root：

```sh
python3 scripts/build.py
python3 scripts/check.py
python3 scripts/test.py
```

`check.py` 檢查單檔產物是否與來源一致、作者 JS／測試語法、Python 語法、Markdown 本地連結、manifest 的來源路徑與遊戲版本，以及 `git diff --check`。它附帶狹義 secret pattern 檢查，但不是完整 secret scanner；不檢查 Git 歷史、不呼叫外部文件連結、不驗證 Markdown heading fragment，也不是完整 CSS／HTML lint。

`test.py` 依名稱執行 `tests/*.test.cjs`，任一 suite 失敗就回傳非零 exit code。找不到 suite 也會失敗，不會把零測試當成功。輸出位於忽略提交的 `test-results/`，包括 `unit-summary.json`、各 suite log 和部份 JSON 明細。不要把上次報告當成本次證據。

## 瀏覽器前置與完整檢查

```sh
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
python3 scripts/test.py --browser
```

Linux 缺少 browser 系統套件時，可在有安裝權限的環境執行 `python3 -m playwright install --with-deps chromium`；CI 使用此方式。只重跑 browser 用 `python3 scripts/test.py --browser-only`。若環境已有合適的 Chromium：

```sh
RIFT_BROWSER_EXECUTABLE=/usr/bin/chromium python3 scripts/test.py --browser-only
```

`tests/browser_smoke.py` 自行啟動 loopback 隨機 port HTTP server，結束時清理。需要允許本機 socket 和 browser process；受限制的雲端環境須使用環境提供的合法權限流程。不要為測試關閉 TLS 檢查或移除安全隔離。Playwright 版本以 [requirements-dev.txt](../requirements-dev.txt) 為準；預設使用該版本安裝的 Chromium，指定系統 browser 時須記錄實際版本。

## 測試分層與真實範圍

| Suite | 驗證範圍 | 限制 |
| --- | --- | --- |
| [vitals.test.cjs](../tests/vitals.test.cjs) | FSM 鎖定、HP／架勢分段、飲藥中斷、兩核心／復燃 | Node 中的 production FSM／Vitals；沒有畫面 |
| [engine.test.cjs](../tests/engine.test.cjs) | 真正 `Game.step`、攻防與裝備、倒地／finisher、固定時間步、22 課與隔離、實際兩斬連段 | VM 中執行 production core；DOM、render、audio 為 adapter mock；多數 case 以 debug 設定初始狀態 |
| [ai-navigation.test.cjs](../tests/ai-navigation.test.cjs) | 上下平台追蹤、遠近導航、藥品、安全距離與中斷 | 確定性場景，不等於所有任意地形已驗證 |
| [audio-ai.test.cjs](../tests/audio-ai.test.cjs) | AI 延遲視野、階段／鎖定與計時；合成 SFX 清理與 voice cap | 模擬 AI 與 Web Audio nodes，不證明真實喇叭出聲 |
| [audio-music.test.cjs](../tests/audio-music.test.cjs) | 音樂切換、loop、fade、duck、音量、mute、pause、media failure、底噪fallback及peak ceiling | Mock media／AudioContext |
| [ios-audio.test.cjs](../tests/ios-audio.test.cjs) | `interrupted`、手勢重試、未完成 resume、舊 promise 順序、audioSession 相容 | 模擬 iOS 授權狀態；不是 iPhone／WebKit 測試 |
| [authority.test.cjs](../tests/authority.test.cjs) | 防守方結算、ID 去重、資料驗證、100／200 ms 模擬延遲、pose 權限與 transport lifecycle | Mock Peer／計時；不證明真實 NAT、TURN 或跨網路 DataChannel |
| [combat-rhythm.test.cjs](../tests/combat-rhythm.test.cjs) | 真實多波碰撞／連續招架、空按懲罰、按住格擋、收刀與受擊緩衝、Boss三核及AI蓄刺真實視覺提示 | 正式simulation；提示測試讀正式renderer計時方法 |
| [mobility-counter.test.cjs](../tests/mobility-counter.test.cjs) | 蓄刺單次接觸／格擋／招架、蹬踏緩衝／範圍／平台阻隔／去重／承諾動作、雙端防守權限 | 正式輸入與simulation，27項情境 |
| [boss-vitals.test.cjs](../tests/boss-vitals.test.cjs) | 240/220/3容量、恢復門檻、治療中斷與三核生命週期 | 共用FSM/Vitals |
| [ai-rhythm.test.cjs](../tests/ai-rhythm.test.cjs) | 三階段固定招式組合、反擊空檔、成本及HP比例 | AI輸入接正式simulation，部分資源隔離fixture |
| [browser_smoke.py](../tests/browser_smoke.py) | 真 DOM／Canvas、滑鼠鍵盤、音樂解碼與 graph samples、pause、Boss三核心到勝利／重開、觸控尺寸／長按／雙指／取消、房號可編輯 | Chromium，包含明確初始狀態注入；headless samples 不證明硬體輸出 |

`tests/helpers/engine.cjs` 是 headless adapter；production 邏輯仍來自 `src/`，不能複製傷害公式到 mock 以使測試看似通過。`tests/cases/` 為 engine 行為場景。修改 renderer／DOM wiring 時不能只依靠 VM：它們刻意跳過畫面和真實事件系統。

Browser 報告與截圖位於 `test-results/browser/`。Smoke 使用正式 resolver 降低 Boss HP，再送正常 attack input 檢查兩次終擊和重開；它不是 AI 自動打贏完整比賽的證據。觸控透過 Chromium 原生 touch event 注入，多點輸入是真瀏覽器行為，仍不代表所有 iOS 手勢一致。

## 修改與測試對照

| 變更 | 必須覆蓋 |
| --- | --- |
| 戰鬥／時序／FSM／Boss | Vitals、engine、AI、authority；browser 完整勝敗／重開；比較原 Boss pattern |
| 新 move／裝備 | 成本、active window、命中去重、block／deflect／counter、armor／invulnerability、教學和網路重播 |
| Audio／輸入／UI | 音訊 suites、browser、手動 iPhone Safari／Chrome；背景恢復、長按／雙指／選字保護 |
| Build／素材／dependency | build `--check`、syntax、完整 suites、實際 MP3 解碼／Page boot、產物大小與 license |
| 文件 | check links／manifest、命令實跑、確認 IMPLEMENTED 與 PLANNED；跨 source 變更則完整回歸 |
| 未來存檔／背包／關卡 | 先補 schema migration、重複事件、資料損壞與 transition integration，再標示 IMPLEMENTED |

新增 regression 應重現使用者可觀察的錯誤或契約。不要寫只把 implementation 常數複製一次的測試；先證明舊行為可失敗，修正後才通過。隨機系統使用可重現 seed／fixture，不依賴運氣或任意長 sleep。失敗時保留首次證據，修正原因後只重跑受影響與必要回歸，不盲目重跑直到變綠。

## CI 與交付證據

**IMPLEMENTED**：[ci.yml](../.github/workflows/ci.yml) 在 `main` push、PR 或手動執行，檢查 build drift／syntax／文件，再跑 Node 與 Chromium，保留 `test-results` artifact 14 天。只有讀取 repository 權限，不需要 secrets。它是驗證 workflow；現有 branch-based Pages **不等待此 CI**，發布與回退依 [DEPLOYMENT](DEPLOYMENT.md)。

每次交付記錄：commit／artifact hash、Python／Node／browser 版本、實際命令與結果、fixture／mock 範圍、未測平台。真實 iPhone 音效、不同網路雙人連線、實體 gamepad／無障礙與效能皆需另行驗證。不可把「模擬成功」改寫成「iOS／WebRTC 已完全驗證」。
