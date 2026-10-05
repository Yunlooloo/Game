# Project Status

Last Updated: **2026-10-05** · 狀態快照；歷史理由見 [WORK_LOG](WORK_LOG.md)，最新交班見 [CURRENT_HANDOFF](CURRENT_HANDOFF.md)。

## Current Version

**IMPLEMENTED：4.0.2**，協議版本3。此次維護整理不修改遊戲產物，因此不升runtime版本；詳細更動見 [CHANGELOG](../CHANGELOG.md)。

## Current Playable State

可從大廳選裝、挑戰「赤衡」、同屏雙人或進入22課陪練；有多層競技場、掛索、天候、五工具／兩奧義、兩核心復燃、勝敗及重試。PeerJS雙人模式已有實作，但真實跨網／實機品質仍需驗證。線上遊玩入口在 [README](../README.md)。

| 狀態 | 系統 |
| --- | --- |
| IMPLEMENTED | 固定60Hz、角色移動、攻防／反制、FSM、HP／架勢／倒地、二階段與雙核心 |
| IMPLEMENTED | 單一Boss的延遲感知、導航、治療；22課訓練與課程完成紀錄 |
| IMPLEMENTED | Canvas人物／場景／VFX；合成SFX和兩首內嵌BGM；滑鼠／鍵盤／觸控 |
| IMPLEMENTED | source版控、可重現單檔build、Node測試、Chromium smoke、品質CI和本文件系統 |
| PARTIAL（不是完整平台保證） | P2P線上流程有實作／mock測試，但跨網連通未證實；iOS修正有模擬測試，缺實機結果 |
| PARTIAL | 響應式CSS／safe-area已存在，Canvas旋轉後resize仍缺listener；設定只存在記憶體 |
| PARTIAL | Boss phase支援目前兩核心特例，尚非可任意配置階段／多Boss架構 |
| PLANNED | Boss registry、第三actor、關卡／Encounter切換、故事／NPC／對話／任務 |
| PLANNED | 背包／裝備數值／通用status effect、進度／成就、版本化save與migration |
| OPTIONAL | XP／商店／掉落經濟、Localization、controller／PWA、server-authoritative排名 |

`PARTIAL` 是已實作子集的完成度說明，不取代 IMPLEMENTED／PLANNED／OPTIONAL 對功能存在性的區分。

## Architecture State / Health

| 分類 | 現況 | 修改邊界 |
| --- | --- | --- |
| Stable | FSM／Vitals基本契約、單檔builder | 以既有回歸與build一致性維護；不是宣稱無bug |
| Acceptable | 小型可變world、單Boss controller、原生IIFE／Rift*模組 | 在目前duel規模可用，先延伸再抽離 |
| Needs Improvement | core協調過多、單一Boss／固定地圖、二actor／100HP跨模組假設 | 第二Boss先做最小definition/factory；多敵人另做identity遷移 |
| Fragile | 教學wrapper依賴resolver、手勢音訊恢復、Canvas旋轉、未驗證實網 | 修改必測對應場景；完整Save尚不存在，不能稱其migration穩定 |
| Avoid Changing Without Review | bootstrap順序、fixed tick/hitstop、defender authority、兩核心、存量storage/protocol IDs | 先Impact Analysis、相關ADR與相容回退；不是永遠禁止修改 |

目前**沒有 runtime migration in progress**。本次只把既有完整來源收編；歷史 `/workspace/ashina-build` 不再是維護真實來源，也不被build/test依賴。未新增未啟用的Boss/Save/EventBus空殼。

## Known Issues

詳 [TECH_DEBT](TECH_DEBT.md)：TD-03實網連通、TD-04 iPhone實機、TD-16旋轉resize、TD-01/02核心擴充邊界、TD-05/17資源權利與vendor provenance。這些尚未因文件整理而修復；完整重現／完成條件只維護在技術債文件。

## Current Development Focus

完成可重現開發流程及多人／多AI的專案記憶；下一項內容開發建議用第二Boss驗證extension point，而非先重寫所有系統。沒有作者承諾的發行排程。

## Next Recommended Tasks

1. 修正Canvas尺寸同步，測進行中旋轉／resize／DPR。
2. 真實iPhone驗證聲音啟動、背景恢復與雙指操作。
3. 兩裝置不同網路驗證WebRTC連通／斷線流程。
4. 依 [BOSS_SYSTEM](BOSS_SYSTEM.md) 建最小registry/factory並加入第二Boss，保留赤衡基準。
5. 補齊音樂與vendor權利／來源紀錄。
6. 第一項永久解鎖需求出現時，連同Save schema／migration實作。

每次完成實質任務由當次維護者刷新本快照，不把舊的「正在做」累積在此。驗證結果見 [VALIDATION](VALIDATION.md)。
