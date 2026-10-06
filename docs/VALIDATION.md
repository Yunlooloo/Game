# 4.1.0 驗證紀錄

Date: 2026-10-06 · Baseline: `00a67c4a7f632482dca0027e47330d6253797501` · Runtime4.1.0 / protocol4。

**IMPLEMENTED**：以下為本次實際執行證據，日常命令見 [TESTING](TESTING.md)。先前4.0.2文件建置證據保存在Git歷史與WORK_LOG；不沿用舊pass數字。

## Build / Static / Unit

- `python3 scripts/build.py`、`--check`：PASS。14,346,011 bytes，SHA256 `13f1b7a951affc759acef773114ea87eed60ae1cf3a96cdfd8606eb1a7aed358`。
- `python3 scripts/check.py`：PASS；JS/Python語法、產物、文件連結、manifest、狹義secret pattern與diff空白；不是完整CSS/HTML lint。
- `python3 scripts/test.py`：**10/10 suites PASS**。
- 正式engine **129/129**（含22課＋離開/結業護欄）、authority **49/49**（包含拒絕舊協議3）、新combat-rhythm **18/18**、AI-rhythm **9/9**、Boss-vitals **6/6**。
- 其餘保留導航、音訊、iOS模擬及Vitals回歸。原有測試因新合法時序／AI欄位／裂斬移除chip而更新期望；未關掉失敗案例。

## Browser / Review

`RIFT_BROWSER_EXECUTABLE=/usr/bin/chromium python3 scripts/test.py --browser-only`：**29/29 PASS，0 JavaScript exceptions**。

真HTTP/DOM/Canvas、滑鼠鍵盤、非零Web Audio samples、BGM切換、pause、赤衡三核／兩次復燃／勝利／重試、紫色提示後真實碰撞招架、手機大鍵長按／雙指／取消／防選取／可編輯房號。戰鬥勝敗使用明確fixture注入低HP，不能稱為真人擊敗Boss。

已檢視 `test-results/browser/rift-cue.png`、desktop.png：三核心HUD、角色與可招架提示可見；報告/截圖為ignored產物。實機聽覺、主觀爽感與平衡仍要玩家驗證。

獨立程式審查發現AI蓄斬假輕斬提示；修正後以正式AI／renderer attackBeat／resolver證明兩拍均能依提示招架。未發現新的action=Infinity死鎖或容量/HUD回歸。

工具：Python3.12.14、Node24.19.0、Playwright1.62.0、Chromium151.0.7922.173。

## Deployment

本機驗證完成；推送後須核對此版本CI、Pages commit與公開HTML完整hash。步驟由 [DEPLOYMENT](DEPLOYMENT.md) 維護，推送後補記本節。

## 未測／保留限制

沒有實體iPhone/WebKit出聲或真實跨網WebRTC驗證；Chromium觸控／音訊graph不等於Safari或硬體輸出。Canvas旋轉仍為TECH_DEBT的TD-16；未實作的Inventory/Stage/Story/完整Save沒有虛構測試。
