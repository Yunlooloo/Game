# Current Handoff

## Last Updated / Last Agent

2026-10-05 · **Codex**。本檔只保留最新一棒；前次任務脈絡保存於 [WORK_LOG](WORK_LOG.md)。

## What I Was Working On

將原本只有發行HTML的遊戲整理成可長期維護、可重現建置、跨AI接手的repository；保留目前4.0.2玩法與Pages方式。

## What Is Finished

- 原始九模組、HTML/CSS、PeerJS及音樂納入版控；portable builder產物與原版逐位元相同。
- 系統現況、未來Boss／敵人／能力／道具／Stage／故事／Save契約、Cookbook與Mermaid圖。
- Node回歸與Chromium smoke、品質CI、部署／rollback／資安依賴文件。
- AGENTS、導航、狀態、工作日誌、協作協定、ADR與技術債。

## What Is Not Finished

本次沒有實作第二Boss、runtime registry、inventory、stage切換、dialogue、通用effect或完整save；這些均是PLANNED。未修Canvas旋轉缺口，未完成真實iPhone音訊與跨網WebRTC驗證。不要誤將文件提案當已啟用API。

## Important Context / Decisions

單檔是刻意的發行契約；維護來源已移到repo內，**不要回去改私人工作區再忘記提交source**。目前每場兩actor、normalized100HP，不可只添第三人或任意maxHP。保留FSM／defender裁決／hitstop輸入；registry由真實第二份內容需求再引入。理由見 [ADR](adr/README.md)。沒有runtime migration in progress。

## Files You Should Read First

[README](../README.md) → [AGENTS](../AGENTS.md) → [AI_HANDOFF](AI_HANDOFF.md) → [PROJECT_STATUS](PROJECT_STATUS.md) → 本檔／[WORK_LOG](WORK_LOG.md) → [ARCHITECTURE](ARCHITECTURE.md) → 此次任務system文件。合作細節見 [AI_COLLABORATION](AI_COLLABORATION.md)。

## Safe Next Tasks

1. 修正resize listener並建立旋轉回歸；此任務不用改combat。
2. iPhone／不同網路的實機驗證，留下裝置與版本證據。
3. 照BOSS_SYSTEM做第二Boss的definition/factory／本機selector，保留赤衡。

## Dangerous Areas / Do Not Change Casually

`Game.frame/step`、`RiftFSM.enter`、`RiftVitals.takeNode`、`RiftAuthority`、`RiftTutorial.observeCombat`、`RiftAudio.start`與觸控edge buffering。它們各有跨模組時序契約，並非不能改，但不能憑偏好重寫。兩人HUD／相機／`1-id`與HP100上限分散，需要整體Impact Analysis。

## Current Build State / Current Test State

Build **PASS**：14,335,866 bytes，SHA256 `10a98714423629033c78cd756e7d2305a9276c4de530d81b5568ce56bbb0d81a`，runtime不變。

最終本機 **PASS**：check、7/7 Node suites、26/26 Chromium checks、乾淨複本build/check/unit。最終命令、環境、實測範圍與本次更新後結果由 [VALIDATION](VALIDATION.md) 維護；重新接手仍要跑自己的baseline，不能沿用這些數字當新修改證據。

## Release / Remaining Verification

Pages維持`main:/`。本次交付前仍會完成最終文件check、乾淨複本、commit/push與公開artifact核對；實際完成狀態以此次最後的commit／CI／Pages紀錄及VALIDATION為準。下一位若看到未提交工作，先查git status/log，不假設這份交班代表已push。
