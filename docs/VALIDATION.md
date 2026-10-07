# 4.2.0 驗證紀錄

Date: 2026-10-07 · Baseline: `ca0625ff2e1bedbc21553321e4a77d019754d8ea` · Runtime4.2.0 / protocol5。

**IMPLEMENTED**：以下是本次實際執行證據；日常命令見 [TESTING](TESTING.md)。歷史驗證由Git／WORK_LOG保留，不沿用舊pass數字。

## Build / Static / Unit

- `python3 scripts/build.py`、`--check`：PASS。14,351,038 bytes，SHA256 `2bcff6bb08faa2e8c1d7a5a498429b5284445559cd62e11b4112f00f77b3cecf`。
- `python3 scripts/check.py`：PASS；JS/Python語法、source／artifact一致性、文件連結、manifest、狹義secret pattern與diff空白；不是完整CSS/HTML lint。
- `python3 scripts/test.py`：**11/11 suites PASS**。
- mobility-counter **27/27**：正式長按蓄刺單次接觸、格擋／招架、危險突刺區別、雙斷用途、蹬踏空間／12tick緩衝／18tick收招邊界、平台／行動鎖與兩端defender ownership／重送去重。
- audio-music **40/40**、iOS permission **13/13**；既有engine **129/129**（含22課及離開／結業護欄）、authority **49/49**、combat rhythm **18/18**、AI rhythm **9/9**、Boss vitals **6/6**均維持通過。
- 未停用失敗案例；charged相關舊雙波期望及protocol4按新規格更新。沒有新增未使用框架。

## Browser / Audio / Review

`RIFT_BROWSER_EXECUTABLE=/usr/bin/chromium python3 scripts/test.py --browser-only`：**51/51 PASS，0 JavaScript exceptions**。

- 真HTTP／Canvas啟動、滑鼠鍵盤、三核心Boss／兩次復燃／第三次勝利／重試，以及紫色提示後實際招架。
- 手機390×844、844×390、320×568、568×320：跳躍在左右上方且置中、六主鍵至少64px、抽屜收展不重疊、工具可用、HUD選單、雙指移動＋跳／架、防選取、取消及房號可編輯。
- 實際BGM播放／切曲／pause和非零Web Audio輸出；音樂音量零後檢查實際輸出及三層ambience均靜音。
- OfflineAudioContext以正式ceiling曲線處理0.5振幅波形，誤差低於1e-6；2倍振幅輸出限制於0.92附近。另以相同compressor基準獨立比對正弦諧波，沒有因ceiling增加正常音量失真。
- FFmpeg檢查兩首原MP3峰值約−3.32／−5.24dBFS，無NaN／Inf，未見數位削波；ambient metadata含Rain and Vinyl Crackle。這不證明原曲無可聞沙沙聲，也不代表實體手機聽感驗證。
- 已檢視四尺寸與紫色提示截圖，窄直向／橫向重疊已修正；測試報告和截圖留ignored `test-results/`。

獨立審查未發現蹬踏行動鎖／平台／網路權限缺陷；雙端測試已保存而非僅留臨時腳本。勝敗fixture明確注入低HP，不能稱為真人擊敗Boss。

工具：Python3.12.14、Node24.19.0、Playwright1.62.0、Chromium151.0.7922.173。

## Deployment

**PASS**：遊戲提交 `0e0c116b9a079b43114368a74a3e60d9c9ca15bc`（`feat: improve mobile counters and clean music mix`）已推送main。

- [CI 37634488346](https://github.com/Yunlooloo/Game/actions/runs/37634488346)：completed / success，head為上述提交。
- [Pages 37634486397](https://github.com/Yunlooloo/Game/actions/runs/37634486397)：completed / success；Pages API為built、commit相同。
- `https://yunlooloo.github.io/Game/?v=4.2.0`：HTTP200，14,351,038 bytes，完整SHA256與本機 `2bcff6bb08faa2e8c1d7a5a498429b5284445559cd62e11b4112f00f77b3cecf` 相同。
- 本節在其後的文件提交補記；該提交不更改runtime或HTML。未來發布仍需對自己的HEAD檢查CI／Pages，不應將本次通過當作永久保證。

## 未測／保留限制

未取得實體iPhone/WebKit聲音、觸控與真實跨網WebRTC結果；Chromium模擬不等於Safari或硬體喇叭。四尺寸測試是各自載入，不代表同局旋轉；Canvas resize仍為TD-16。沒有對不存在的Inventory／Stage／Story／Save虛構測試。手感及原曲音色需使用者實際試玩／試聽。
