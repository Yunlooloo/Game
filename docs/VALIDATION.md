# 本次維護整理的驗證紀錄

Date: 2026-10-05 · Runtime: 4.0.2 · Baseline: `e5847fa279a49a92b0f7fc296dfe052b751648b2`

**IMPLEMENTED**：以下是本次真正執行的檢查。日常命令由 [TESTING](TESTING.md) 維護；報告與截圖產生於ignored `test-results/`，不必依賴雲端私人目錄。新任務應重跑，不能把本紀錄當永久保證。

## 建置與相容性

- `python3 scripts/build.py`、`python3 scripts/build.py --check`：PASS。
- 產物 **14,335,866 bytes**，SHA256 `10a98714423629033c78cd756e7d2305a9276c4de530d81b5568ce56bbb0d81a`；與整理前HTML逐位元相同，`git diff -- index.html` 為空。
- 九個runtime JS模組、HTML/CSS、PeerJS與MP3原檔原樣收編；沒有玩法、版本、storage或protocol改寫。
- Builder額外7項：搬移來源後重建、重複marker拒絕、缺marker拒絕、缺module拒絕、不同cwd執行、`--check`發現drift且不寫檔、大小寫HTML script terminator escaping，全部PASS。
- 從Git檔案清單建立乾淨臨時複本，重新執行build／check／7組unit suites：PASS。未讀取原工作區helper或歷史附件。

## Static / Unit / Browser

| 實際執行 | 結果 | 範圍 |
| --- | --- | --- |
| `python3 scripts/check.py` | PASS；22 JS檔及當次所有本地文件連結 | build drift、JS/Python語法、文件link／manifest版本／路徑、狹義secret pattern與diff whitespace；不是完整HTML/CSS lint或Git歷史稽核 |
| `python3 scripts/test.py` | **7/7 suites PASS** | AI導航、audio/AI、音樂生命週期、authority、engine、iOS模擬授權、vitals |
| engine suite明細 | **129/129** | 34基本、37機制、33倒地/時序、24教程、1實際兩斬連段；正式simulation＋headless adapters |
| authority/transport明細 | **49/49** | owner、去重、驗證、模擬延遲與transport lifecycle；不是實網連通 |
| `RIFT_BROWSER_EXECUTABLE=/usr/bin/chromium python3 scripts/test.py --browser-only` | **26/26 PASS，0 JS exceptions** | 真DOM/Canvas、滑鼠鍵盤、非零音訊graph samples、兩核至勝利與重開、pause、手機長按／雙指／取消／防選取 |
| `git diff --cached --check` | PASS | 既有render/vendor尾端空行按ADR-001原樣保留；其他檢查啟用 |

本次工具：Python **3.12.14**、Node **24.19.0**、Playwright **1.62.0**、系統Chromium **151.0.7922.173**。GitHub CI另以Node22和Playwright安裝的Chromium在乾淨runner完成同一流程，結果為success（連結見下）。

移植過程曾因舊smoke selector `#restart` 而失敗，已依真實DOM修正為`#retry`後完整重跑通過；沒有修改遊戲迎合測試。Browser runner在啟動前覆寫report狀態，避免啟動失敗後誤讀舊成功報告。

## AI 接手驗收

獨立審核只讀README／AGENTS／AI_HANDOFF，全部17項入口問題都能回答或直接找到權威文件；追加協作規則後，第二次獨立審核確認下列A–D情境沒有重大導航或架構缺口。文件核對修正了帶電旗標不倒數、教學斷決gate、protocol握手不檢查runtime版本等易誤解說法。

| 情境 | 結果與證據入口 |
| --- | --- |
| A：新AI加Boss | 可由AGENTS→BOSS_SYSTEM→Cookbook找到現有RiftAI、預設赤衡、待建立definition/factory/registry、素材與測試；清楚標示registry尚不存在 |
| B：半年後恢復上下文 | PROJECT_STATUS快照、CURRENT_HANDOFF最新一棒、WORK_LOG理由、ADR與Git歷史分工，不依賴聊天 |
| C：另一AI想大重構 | Impact Analysis、ownership、ADR、技術債、Working Agreements說明刻意契約與可改善接點 |
| D：內容成長 | 有按類別registry／composition／stableID／save migration／encounter演進路徑；目前runtime仍是兩actor原型，沒有宣稱已實測20Boss或完整RPG規模。首個驗證門檻是第二Boss垂直切片 |

## 發布驗證狀態

主要提交 `2bd17727bd91338e838b55fee9a281f47c02b90e` 已推送 `main`。

- [GitHub CI run 37306992454](https://github.com/Yunlooloo/Game/actions/runs/37306992454)：**success**。乾淨checkout、build／syntax／docs、Node suites、安裝Playwright browser、Chromium smoke與報告artifact步驟全部成功。
- [Pages run 37306990062](https://github.com/Yunlooloo/Game/actions/runs/37306990062)：**success**，對應上述commit。
- 公開 `index.html` 回應HTTP200、14,335,866 bytes，完整內容與本機hash逐位元相同；公開 `README.md` 同樣HTTP200且內容一致。
- 本段和最新交班補記為後續 **docs-only** 提交，沒有修改source／builder／tests／遊戲產物。它不取代未來提交的CI／Pages驗證；交付時仍需核對最新run。

發布步驟及未來回退唯一操作來源為 [DEPLOYMENT](DEPLOYMENT.md)。

## 仍未驗證／未修改

無實體iPhone／WebKit出聲或所有裝置結果；headless graph samples不證明揚聲器輸出。真實跨網WebRTC沒有新增連通證據。旋轉resize缺口已記TD-16，本次不混入runtime修正。未實作Inventory/Stage/Story/完整Save，因此沒有聲稱相應未來測試已通過。詳 [TECH_DEBT](TECH_DEBT.md)。
