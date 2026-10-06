# AI 任務模板

以下是未來任務的輸入模板（**OPTIONAL** 工作方式），不是目前已實作功能清單。開始依 [AGENTS](../AGENTS.md) 的完整交接閱讀鏈讀狀態／最新交班／工作日誌／架構，再讀指定系統；完成條件採 [DEVELOPMENT](DEVELOPMENT.md)。非微小修改先做Impact Analysis，實質任務完成更新PROJECT_STATUS、CURRENT_HANDOFF、WORK_LOG並提供Handoff Summary。將尖括號內容換成需求，未填部分先從程式及現有 pattern 查證。

## Feature

```text
目標：<玩家能觀察到的結果>
範圍：<模式／平台／場景>；不包含：<界線>
驗收：<正常、邊界、失敗時各如何表現>
先讀：AGENTS.md、docs/AI_HANDOFF.md、<system document>
請先核對現有來源與測試，標記 IMPLEMENTED/PLANNED 接點。
維持既有玩法，提供最小實作、測試、文件與必要 CHANGELOG。
提交／部署授權：<僅本地／commit／push main／發布>
```

## Bug Fix

```text
問題：<實際 vs 預期>
重現：<模式、裝置／OS／瀏覽器版本、操作步驟、發生頻率>
觀察：<console 或畫面，勿放 secret>
先建立會失敗的重現／測試，再修最小根因。
特別保留：<已知正常的相鄰行為>
完成後回報原因、回歸、尚未實測平台，以及授權範圍內的提交／部署。
```

## Refactor

```text
原因：<已出現的重複／耦合／阻礙>
範圍：<函式／模組>
不變契約：<FSM、幀數、damage、輸入、storage、network 等>
先讀架構、ADR 及對應測試，不為假想需求建框架。
以相同行為的測試／build artifact 證明相容；必要時提供ADR與回退。
不要夾帶平衡或美術修改。
```

## Content Addition：第二名 Boss

```text
請增加一名可選測 Boss。
Boss ID：boss_<slug>
顯示名稱：<短原創名稱>
機制：<攻擊節奏、反制、Phase 2、特色與公平提示>
使用素材：<原創程序繪製／已確認權利的素材>
先讀 AGENTS.md、docs/AI_HANDOFF.md、docs/BOSS_SYSTEM.md、
docs/CONTENT_COOKBOOK.md、docs/COMBAT_SYSTEM.md。
現況尚無 registry；照文件建立最小 definition/factory/本機 selector，
共用 input/FSM/resolver，保留赤衡；使用既有maxHp/maxPosture/maxNodes；不擅自改PvP100標尺／兩actor／線上協議。
測試新舊兩Boss、第一核復燃／第二核結束、相同防守方裁決。
更新文件、CHANGELOG，依授權提交及部署。
```

Enemy／Ability／Item／Stage／Dialogue 可替換上述類別和 stable ID，並改讀對應系統文件。若新能力尚無基礎系統，先做一項完整垂直切片，不能僅新增不被載入的 JSON 就聲稱功能完成。

## Deployment

```text
發布範圍：<commit／branch>
目標：目前 GitHub Pages main:/（若要變更先說明原因）
先讀 docs/DEPLOYMENT.md、docs/TESTING.md。
驗證來源／產物／tests，檢查無 secret；使用已提供的安全認證。
提交且push授權：<是／否>；不要force push。
完成後確認Pages build commit與公開HTML內容，提供可用網址。
失敗先依TROUBLESHOOTING診斷；需要回退用revert，不清除既有歷史。
```
