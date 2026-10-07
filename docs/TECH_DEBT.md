# 已知限制與技術債

以 2026-10-07、runtime 4.2.0 更新；保留原問題ID。優先度不是排程承諾；下列缺口沒有因為文件建立而自動修好。

| ID／優先度 | 狀態與證據 | 影響／暫時做法 | 完成條件 |
| --- | --- | --- | --- |
| TD-01 High | IMPLEMENTED 限制：`Game` 集中 UI、輸入、世界、combat；`players[1-id]` 和固定兩欄 HUD | 多敵人不能只 push actor；先維持 duel | 以第三 actor 測試驗證 entity identity／target query／UI／camera／authority |
| TD-02 High | IMPLEMENTED 限制：Boss 策略單一 `RiftAI`，Boss profile仍在core；Vitals已支援容量，PvP/net ranges維持100 | 第二 Boss 先做 definition/factory，重用容量helper並維持PvP契約 | 赤衡和第二 Boss 都能單獨選測，同一 resolver 測試全部通過 |
| TD-03 High | 未完成驗證：managed browser 真實 WebRTC 曾只有 null ICE candidates | 模擬 100/200 ms 不能證明跨網可玩；保留清楚連線錯誤 | 兩實際裝置、不同網路連接成功，延遲／斷線／重連有紀錄 |
| TD-04 High | 未完成驗證：iOS 音訊修正有 Chromium／simulated permission 測試，無實體 iPhone 結果 | 不聲稱 Safari／Chrome iOS 實機已驗證 | iOS 前景／背景／靜音切換／觸控音樂與 SFX 的實機紀錄 |
| TD-05 High | 權利待確認：未指定專案 license，使用者提供 MP3 權利資訊不完整 | 保留來源，不宣稱全資源 MIT 或商業零風險 | 由所有者明確記錄素材使用／再散布權與專案授權 |
| TD-06 Medium | IMPLEMENTED：`RiftTutorial.observeCombat` monkey-patch 三個 resolver | 小改函式簽名也可能使課程失效；必須跑教學測試 | 真正需要第二 observer 時導入 outcome events，保留22課驗收 |
| TD-07 Medium | IMPLEMENTED：14.3 MB HTML，音樂 base64 帶來約 33% 編碼成本，HTML/JSON/media 有多份記憶體 | 保持原音檔與單檔規格；手機載入要量測 | 裝置量測載入／峰值記憶體後，用 ADR 決定壓縮或可選多檔發行 |
| TD-08 Medium | IMPLEMENTED：僅 tutorial IDs localStorage，無完整 save/schema/settings persistence | 不把 runtime scores/loadout 誤稱永久進度 | 首個 persistent feature 同時導入 schema validation／migration／backup |
| TD-09 Medium | IMPLEMENTED：Game DOM 操作、display strings 分散；無 Localization registry | 保持短原創用語；不要改 stable protocol IDs | 引入第二語言時有 key fallback、字體／長字串／輸入 UI 回歸 |
| TD-10 Medium | IMPLEMENTED：隨機天雷／VFX 與 AI 不共用 deterministic seed | fixed tick 不等於全局 deterministic replay | 若要 replay/rollback，分 simulation RNG 與 presentation RNG 並驗證快照 |
| TD-11 Medium | IMPLEMENTED：高速閃光／震動尚無完整 reduced-motion 遊戲選項 | 使用者可控制音量；不宣稱已完成無障礙 | 遊戲特效遵守設定、警示不只靠顏色／聲音 |
| TD-12 Medium | IMPLEMENTED：公開 `game.debug`、defender trust model、無 server authority | 適合好友對局，不能當防作弊競技基礎 | 若做排名／獎勵，另設 authoritative service 與威脅模型 |
| TD-15 Medium | IMPLEMENTED：Pages `main:/` 自動發布，test CI 不是 branch deploy gate | push 前本機驗證；失敗時 revert | 需要多人協作時再引入保護分支或驗證後 artifact deploy 的 ADR |
| TD-16 High | 已確認：`RiftRenderer.resize()` 只在 constructor 呼叫，沒有 resize listener／ResizeObserver | 旋轉後 CSS 與 bitmap／camera viewport 可能不同；暫以重新載入恢復 | 監聽實際尺寸變化並重設兩張 canvas，測試進行中旋轉與 DPR 改變 |
| TD-17 Medium | 供應鏈資訊：PeerJS1.5.5 bundle 已保存，但無內部依賴 lockfile／完整 provenance | 不把 upstream semver ranges 當作實際打包版本，也不宣稱完成所有授權稽核 | 更新vendor時保存可核對來源、checksum及遞迴license清單 |

## 已修復（保留追蹤）

- TD-13：4.1.0 AI優先讀實際MOVES cost，缺資源轉普通斬；ai-rhythm測試覆蓋。
- TD-14：4.1.0 frame在hitstop不呼叫AI，觀察時鐘與combat同停；combat-rhythm測試覆蓋。
- 招架硬直接防禦的一幀空隙、成功連擋被視為抖刀、紫色波間隱形接觸已修正；仍需真實玩家回饋評估難度，不宣稱數值一次定案。

- 4.2.0擴大蹬踏空間／時間容錯並保留平台遮擋；手機跳躍放在移動鍵上方、技具收合。這不等於已解決TD-16旋轉尺寸或已取得iPhone實機結果。

## 先前已消除

**IMPLEMENTED**：build 原始碼與必要測試不再只存在 `/workspace/ashina-build`。Repository 可以自行重建相同產物，保存來源、依賴說明、文件及自動檢查。這不等於把上述 runtime 技術債修完。

## 分級與後續追蹤

- **Critical**：資料毀損、secret 洩漏、無法啟動等，先修再擴充；本次沒有新確認的 runtime Critical 缺陷。
- **High**：阻礙下一項內容／發布可信度／權利基礎，先完成對應證據。
- **Medium**：有已知邊界、可在當前小規模使用，跨越邊界前處理。
- **Low**：局部品質或一致性；不為它重寫整個 engine。

修復時更新狀態與驗證連結；不要刪除問題歷史冒充從未存在。現況數值與時序仍以 [COMBAT_SYSTEM](COMBAT_SYSTEM.md) 為準。
