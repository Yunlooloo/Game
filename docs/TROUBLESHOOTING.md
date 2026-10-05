# 故障排查

以下先處理 **IMPLEMENTED** 系統。沒有的 inventory、戰役存檔或 StageManager 問題不應套用猜測性的修復；未來功能依對應文件建立自己的診斷。指令在 repository root 執行；安裝、build 和部署完整流程只維護於 [TESTING](TESTING.md) 與 [DEPLOYMENT](DEPLOYMENT.md)。

## 網頁空白／遊戲不啟動

1. 使用 localhost HTTP 或正式 HTTPS；確認回應是遊戲 HTML 而非 404／登入頁。正式路徑含大小寫 `/Game/`。
2. 先執行 `python3 scripts/check.py`，核對產物一致、script 語法與必要 DOM；讀 browser console **第一個**錯誤，不把後續 `game undefined` 當根因。
3. 若 source 已改但頁面仍舊，執行 `python3 scripts/build.py`，再重新載入。不要只編輯 generated `index.html`。
4. 若修改模組順序，檢查 `scripts/build.py` 的 `MODULES` 和 [ARCHITECTURE](ARCHITECTURE.md) 的依賴；`core.js` 依賴先前模組，不能任意換成 async scripts。

無法建立 Canvas／AudioContext 的瀏覽器需記錄 API 和版本；不要用刪掉碰撞或吞掉所有 exception 作為修復。

## npm install／build 失敗

- **沒有 `package.json` 是正常現況**，遊戲不用 npm install。Node 只運行檢查與 VM tests，Python stdlib 負責 build；Playwright 才有 optional pip 安裝。
- `Output is stale`：來源與 HTML 不一致，build 後查看 diff、重跑 checks，再一起提交。
- `Cannot read input`／`Empty input`：依錯誤相對路徑檢查 clone 是否完整、大小寫和 MP3 是否存在。不要指向舊 `/workspace/ashina-build` 當永久補救。
- `expected one marker`：`src/shell.html` 或 tutorial fragment 的插入標記被刪除／重複。恢復唯一 marker，再重建，不可讓部分資源悄悄省略。
- browser test 找不到 Playwright／Chromium：依 [TESTING](TESTING.md) 安裝固定依賴與 browser。若用已安裝的 system Chromium，設定工具專用 `RIFT_BROWSER_EXECUTABLE`；不要修改 production HTML。
- `EADDRINUSE`／端口占用：改用另一個 localhost port，或正常停止自己啟動的 server。`test.py --browser` 自動使用暫時 loopback server，不必預先啟動。

## Pages 404／更新沒有出現

先查 repository 的 Pages source 是否仍為 `main:/`，再比對 latest build 的 `status`／`commit` 與本次提交。實際命令見 [DEPLOYMENT](DEPLOYMENT.md)。Git push 成功、CI 成功、Pages built、公開 HTML 相同，四者不能互相代替。

若 build 成功但裝置仍舊，使用 `?v=<version>` 或 hash 查詢參數重新載入並比較公開 bytes。遊戲沒有 service worker；不應杜撰 SW cache 作為現有問題根因。branch-based Pages 會與驗證 CI 分開執行；CI 失敗不會自動撤銷已發布網站。

`git push` 說 upstream branch 名稱不同時，先確認任務確實授權 main 更新及遠端狀態，使用文件中的 `git push origin HEAD:main`。拒絕 non-fast-forward 時先整合遠端變更；不要 force push 或把 credential 加進 remote URL。

## 素材消失／base path 不對

目前程式畫圖、inline SVG、vendor JS 和兩首 MP3 都由 build 內嵌。正常遊戲不需要向 `/assets/` 發 runtime request；因此部署在 `/Game/` 不需 bundler base 設定。若未來新增了外部 URL，需將它視為新的發行契約並補測，不能假設現有 build 會自動打包。

音樂來源問題檢查 `assets/audio/music/`、build `TRACKS` 與 `#rift-music-data` 的 key；只能回報曲目 key、byte 數和 hash，不能將巨大 data URL 貼入錯誤紀錄。第三首曲目不是單純放檔案就生效，見 [ASSET_PIPELINE](ASSET_PIPELINE.md)。

## iOS 或其他瀏覽器沒有聲音

1. 重新載入最新版本，在前景點一次「開啟聲音」。確認遊戲 mute 與總音量／音樂音量不是零；如果是本機暫停，先恢復對局。
2. 確認裝置媒體音量、實際輸出裝置（喇叭／藍牙／耳機）及系統靜音模式；不要把 Chrome iOS 與 desktop Chrome 測試混為一談。
3. 開發者可讀 `game.audio.getMusicStatus()`。`contextState=uninitialized` 表示尚未成功啟動；`suspended/interrupted` 表示需恢復；`NotAllowedError/playback-blocked` 先用新的可信手勢重試。`invalid-embedded-music/missing-embedded-music/media-error-*` 才朝 build／曲目格式排查。
4. 區分「music seconds 不前進」「有 music 沒 SFX」「兩者都無聲」「context running 但硬體無聲」。回報 OS、瀏覽器版本、前背景操作、靜音／輸出裝置和上述安全狀態；不要要求使用者貼 token 或整份 console environment。

修程式時保留 [PLATFORM](PLATFORM.md) 的同步手勢啟動、pending promise 重試與 `interrupted` 支援；禁止在 `resume()` 的 await 之後才首次 `play()`，也不能 `stopPropagation` 吞掉觸控 `touchend`。有非零 audio analyser 樣本只證明 graph 有輸出，**不是 iPhone 喇叭實測成功**。

## 手機長按選取／移動卡住／按鈕太小

確認當前版本與 CSS 媒體查詢 `(pointer: coarse)` 是否生效。主按鍵一般至少 64 CSS px，橫向較大；若仍為舊布局，先排除 cache。`touchTargets`／held maps 依 pointerId 管理；取消與失焦後應歸零，短按則須保留到下一 fixed tick。

檢查選取事件是否出現在戰鬥表面，不能為解決局部問題將整頁 `touch-action`／`user-select` 關閉，否則會破壞大廳捲動、教學和房號選取。重現時記錄長按、兩指、拖出按鍵、切換應用程式、回前景的順序。

**已知限制**：旋轉／改視窗後 renderer 沒有自動 `resize()`，先在目標方向重新載入再測；這是暫時做法，不代表已修正。後續修復和驗收見 [PLATFORM](PLATFORM.md)／TD-16。

## 線上房間不能加入／連上後失去同步

- 雙方使用相同公開版本，房碼為 6–12 位英數；`?room=` 只預填，不會自動連線。先確認 signaling 建房／入房，再確認 DataChannel 開啟，最後才測 combat。
- 公用 PeerJS signaling、預設 STUN／TURN 及對手網路皆會影響可達性。本遊戲沒有自有可靠中繼保證；`null` ICE candidate 或 signaling 成功都不能單獨證明已可傳資料。
- 記錄 `game.net?.getMetrics()`、網頁錯誤與雙方版本；HUD RTT／序號缺口／延遲訊息不是完整封包丟失率。不要公開完整 SDP、IP、完整封包內容或 credential。
- 先在兩台實際裝置測試，再切不同網路；網路政策阻擋時回報限制，不能停用 TLS 或繞過組織政策。模擬 100／200 ms 測試只能檢查受控同步邏輯。
- 線上無單方暫停；切背景可能導致 30 秒無訊息超時。重新進大廳建房，不假定舊對局有自動 reconnect／state resumption。

收到裁決異常時先核對 attack/contact ID 去重、round 與 authority；不要「修復」成攻擊方直接扣另一位玩家 HP。參閱 [COMBAT_SYSTEM](COMBAT_SYSTEM.md)。

## 遊戲速度、Boss、失衡行為不正常

- 高更新率不應加快攻擊：simulation 固定 60 Hz。檢查新程式是否誤在 renderer 或 DOM event 修改 timer／HP；不要以 render frame 數作招式幀數。
- 長停頓後少補 tick 是 catch-up cap 的設計，不是保證斷線後補跑完整戰鬥。效能診斷見 [PLATFORM](PLATFORM.md)。
- Boss 位於上下層時先讀 `RiftAI` 的導航和 [BOSS_SYSTEM](BOSS_SYSTEM.md)；捕捉雙方 position、platform、FSM、phase 和可見目標，而不是修改玩家座標來掩蓋卡路。
- 失衡後只扣完 HP 不會直接結束；需貼身斷決消耗雙核心，首顆回到第二階段。用 [COMBAT_SYSTEM](COMBAT_SYSTEM.md) 和測試核對，不能將「仍有第一核心」誤當死亡 bug。

## 教學進度遺失／未來存檔損壞

**IMPLEMENTED**：只有 tutorial completed IDs 使用 `localStorage`；沒有全局 save slot。瀏覽器清除網站資料、私密模式／儲存政策或不同 origin 會改變可用資料；配裝／音量／分數本來就不持久化。先核對 [SAVE_SYSTEM](SAVE_SYSTEM.md) 的目前 key 與容錯行為，不要讓玩家為一個設定問題清除整個網站資料。

**PLANNED**：完整存檔加入後，先備份原始資料、驗證 `saveVersion`，只經 migration chain 升級。未知 future version 不可直接當空白新存檔覆蓋；損毀時提供保留與復原流程，不能吞掉例外後自動寫回預設值。

## 回報問題時的最小證據

附遊戲版本／commit、網址、OS／browser、viewport／DPR、模式、重現步驟、預期與實際結果、首個錯誤、適用測試結果。UI 問題附截圖，combat 問題附本機 snapshot 摘要；不輸出完整 `world` 封包、base64 音樂、環境變數或認證資料。標明實機／emulation／mock；結果寫入對應 issue／驗證紀錄後，再更新技術債的狀態。
