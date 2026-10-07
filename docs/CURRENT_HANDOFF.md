# Current Handoff

## Last Updated / Last Agent

2026-10-07 · **Codex**。本檔只保留最新交棒，歷史理由見 [WORK_LOG](WORK_LOG.md)。

## What I Was Working On

4.2.0操作修正：改善空中蹬踏失敗率、手機跳躍與移動的分區，將長按斬改為普通單次蓄刺，並排查BGM雜訊。之前4.1.0的連續招架與三階段赤衡已發布。

## What Is Finished

- `tryStomp()` 消費12combat tick空中跳躍緩衝，水平170px／上方20–240px內可輔助踏入；橫掃收招前18tick仍接受反制。平台阻隔、行動承諾、一次滯空與attackId去重均保留。
- 跳躍可離開DEFLECT，不能取消STARTUP／ACTIVE／飲藥。按住首次跳躍不會自動蹬踏；新攻擊／治療等動作會清掉待蹬踏。
- 穩定ID `charged` 現在是單次普通 `pierce` 蓄刺，36／6／24tick、18HP／22架勢；可擋可架，沒有危字或破普通格擋。Boss只覆寫44tick起手；紅突／雙斷各自保留用途。
- 手機左側「上跳、下方左右」，右側墊步／架／斬六個大主鍵；技具抽屜保留其餘五項能力。暫停移到HUD選單，線上只開手冊。
- 有效／載入中BGM不疊合成風雨河流；音樂零音量不啟用fallback。输出正常振幅線性，峰值仍限幅；原曲不轉碼，iOS手勢解鎖不改。
- 協議5拒絕4；教學ID與localStorage鍵不變，更新教學內容及ADR-005。

## What Is Not Finished / Known Issues

沒有第二Boss registry、Stage/Story/Inventory或完整Save。Canvas旋轉尺寸、真實iPhone聲音與跨網WebRTC仍未驗證／修復；詳 [TECH_DEBT](TECH_DEBT.md)。音樂原檔含雨聲／黑膠音色，不將去除遊戲疊加雜訊描述成消除所有原曲質感。手感需實際玩家回饋，自動測試只證明具體契約。

## Current Architecture / Important Decisions

保留同一input bitmask、MOVES／FSM／Vitals／counter與defender-owned命中路徑；沒有獨立手機戰鬥或反制傷害引擎。Boss仍240HP／220架勢／3核心，玩家/PvP/教學100/100/2。4.1.0的16tick招架、成功重置懲罰、逐波6tick接觸、固定三階段節奏均保留。見 [ADR-004](adr/004-readable-rhythm-and-boss-capacity.md)、[ADR-005](adr/005-stomp-assist-and-charged-thrust.md)。沒有runtime migration in progress。

## Files You Should Read First

[README](../README.md) → [AGENTS](../AGENTS.md) → [AI_HANDOFF](AI_HANDOFF.md) → [PROJECT_STATUS](PROJECT_STATUS.md) → 本檔／[WORK_LOG](WORK_LOG.md) → [ARCHITECTURE](ARCHITECTURE.md) → [COMBAT_SYSTEM](COMBAT_SYSTEM.md)／[PLATFORM](PLATFORM.md)／[ASSET_PIPELINE](ASSET_PIPELINE.md)。

## Safe Next Tasks

1. iPhone橫向實玩：左拇指跳躍／蹬踏、右拇指連擋、技具展開與音訊背景恢復。
2. 獨立修正Canvas旋轉尺寸，保持fixed tick和世界座標不變，加入同局旋轉測試。
3. 不同網路兩裝置验证協議5；內容擴充再依Cookbook提取第二Boss接點。

## Dangerous Areas / Do Not Change Casually

`frame/step`、defender authority、多波contact與蹬踏attackId去重、guardBuffer、DEFLECT窗口、`takeNode`容量、教學wrapper、iOS手勢重試及pointer edges。勿將Boss容量送入現有PvP封包；不能只改charged顯示文字而忽略對手版本相容性。

## Current Build State / Current Test State

**PASS**：build／check、11/11 Node suites、51/51 Chromium checks，0 JavaScript exceptions。最終本機與發布證據統一由 [VALIDATION](VALIDATION.md) 維護；接手仍須在自己的HEAD跑baseline，不沿用舊pass數字。

## Release

4.2.0遊戲提交 `0e0c116` 已推送main，CI／Pages成功，公開HTML逐位元符合本機產物；本次文件補記不改runtime。單檔Pages `main:/`部署方式維持。驗證流程見 [DEPLOYMENT](DEPLOYMENT.md)，結果見VALIDATION；環境設定Publish與網站部署是兩件事。
