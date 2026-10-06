# Current Handoff

## Last Updated / Last Agent

2026-10-06 · **Codex**。本檔只保留最新交棒，歷史理由見 [WORK_LOG](WORK_LOG.md)。

## What I Was Working On

4.1.0戰鬥節奏重整：玩家反映招架太難、Boss出刀太快／後期太容易，要求可學習的連續接刀與三條命Boss。

## What Is Finished

- 16tick招架、成功重置債務；快速空按最低12tick，每刀需重新點按。8tick防禦緩衝，輕招收刀6tick可轉防禦，修復硬直結束無防備一幀。
- 赤衡240HP／220架勢／3核心，兩次滿血復燃後第三次才勝利；所有比例恢復／HUD均接容量helper。
- Boss固定三階段招式組合與反擊空檔；各階段不縮短起手，Boss起手霸體仍受傷／架勢與反制。
- 裂斬兩波相隔24tick、普通格擋無chip，三連斬每18tick；每波6tick接觸、波間無隱形傷害。
- 多波招架保留Boss中途節拍、末刀反彈；實際動畫逐波收刀／放刀，蓄斬不再亮錯輕斬提示。
- hitstop同步凍結AI時鐘；成本從共用MOVES讀取。協議4拒絕3；更新教學、ADR與維護文件。

## What Is Not Finished / Known Issues

沒有第二Boss registry、Stage/Story/Inventory或完整Save。Canvas旋轉、真實iPhone聲音與跨網WebRTC仍未驗證／修復；詳TECH_DEBT。新平衡需要真實玩家回饋，測試只證明具體規則與流程。

## Current Architecture / Important Decisions

延伸既有fighter與MOVES/FSM/Vitals；core的 `BOSS_PROFILE` 與 `attackDefinition` 是目前Boss容量／起手覆寫真實來源，`RiftAI._patterns` 定義階段組合。玩家/PvP/教學100/100/2；只有本機AI Boss240/220/3，線上validator仍100上限。沒有第二套Damage系統、沒有runtime migration in progress。見 [ADR-004](adr/004-readable-rhythm-and-boss-capacity.md)。

## Files You Should Read First

[README](../README.md) → [AGENTS](../AGENTS.md) → [AI_HANDOFF](AI_HANDOFF.md) → [PROJECT_STATUS](PROJECT_STATUS.md) → 本檔／[WORK_LOG](WORK_LOG.md) → [ARCHITECTURE](ARCHITECTURE.md) → [COMBAT_SYSTEM](COMBAT_SYSTEM.md)／[BOSS_SYSTEM](BOSS_SYSTEM.md)／ADR-004。

## Safe Next Tasks

1. 收集新節奏重現案例與實機回饋；優先調清楚的profile/MOVES數值。
2. 獨立處理Canvas旋轉或iPhone音訊實機驗證，不順便換引擎。
3. 第二Boss依Cookbook提取現有profile/controller接點。

## Dangerous Areas / Do Not Change Casually

`frame/step`、defender authority、多波contact去重、guardBuffer與DEFLECT窗口、`takeNode`容量、教學wrapper、iOS手勢與touch edges。不要讓AI在hitstop偷跑、不要把Boss容量送入現有PvP封包；更改波次也要同步renderer提示與協議相容性。

## Current Build State / Current Test State

**PASS**：build/check、10/10 Node suites、29/29 Chromium checks，0 JavaScript exception；其中18項combat-rhythm、9項AI rhythm、6項Boss vitals為新增行為覆蓋。正式測試範圍／限制及發布證據由 [VALIDATION](VALIDATION.md) 維護；接手仍須跑自己的baseline。

## Release

單檔Pages `main:/`部署方式維持；發布核對見VALIDATION。不要把雲端環境設定Publish當作網站部署，也不要沿用舊版本hash作證。
