# 專案知識導航

文件描述的是 repository 可重建的現況。任何新增系統先區分：

- **IMPLEMENTED**：程式已存在，可由連結的 source／tests 核對；不代表已在所有裝置實測。
- **PLANNED**：建議的演進契約與步驟，尚未提供可直接呼叫的 API；不代表作者承諾排程。
- **OPTIONAL**：有需求才評估，不是必須完成的框架。

檔案內若同時含三種內容，以小節／表格／程式範例的狀態為準。範例 schema 不是執行中的資料檔。

## 第一次接手

[根目錄 README](../README.md) → [AGENTS](../AGENTS.md) → [AI_HANDOFF](AI_HANDOFF.md) → [PROJECT_STATUS](PROJECT_STATUS.md)／[CURRENT_HANDOFF](CURRENT_HANDOFF.md) → [WORK_LOG](WORK_LOG.md) → [ARCHITECTURE](ARCHITECTURE.md) → 任務對應文件。快速定位用 [PROJECT_MAP](PROJECT_MAP.md) 或 [機器可讀 manifest](project-manifest.json)。

## 單一真實來源

| 主題 | 權威文件 |
| --- | --- |
| 多人／多AI工作協定、文件ownership | [AI_COLLABORATION](AI_COLLABORATION.md) |
| 即時現況／最新接力棒／永久開發脈絡 | [PROJECT_STATUS](PROJECT_STATUS.md)、[CURRENT_HANDOFF](CURRENT_HANDOFF.md)、[WORK_LOG](WORK_LOG.md) |
| 稽核範圍、原始狀態、版本 | [REPOSITORY_AUDIT](REPOSITORY_AUDIT.md) |
| 現有依賴圖／流程與演進邊界 | [ARCHITECTURE](ARCHITECTURE.md) |
| Loop、Player、World、狀態、事件 | [GAME_SYSTEMS](GAME_SYSTEMS.md) |
| 戰鬥數值、碰撞、網路裁決 | [COMBAT_SYSTEM](COMBAT_SYSTEM.md) |
| Boss／一般敵人／共用能力 | [BOSS_SYSTEM](BOSS_SYSTEM.md)、[ENEMY_SYSTEM](ENEMY_SYSTEM.md)、[ABILITY_SYSTEM](ABILITY_SYSTEM.md) |
| 道具、裝備、屬性與狀態效果 | [ITEM_SYSTEM](ITEM_SYSTEM.md) |
| 關卡、Encounter／故事與對話 | [LEVEL_SYSTEM](LEVEL_SYSTEM.md)、[STORY_SYSTEM](STORY_SYSTEM.md) |
| 持久化、進度與存檔 migration | [SAVE_SYSTEM](SAVE_SYSTEM.md) |
| 美術、動畫、音訊資源 | [ASSET_PIPELINE](ASSET_PIPELINE.md) |
| 平台、輸入、UI、效能、可及性 | [PLATFORM](PLATFORM.md) |
| 安全、依賴與升級 | [SECURITY_DEPENDENCIES](SECURITY_DEPENDENCIES.md) |
| 具體新增內容步驟 | [CONTENT_COOKBOOK](CONTENT_COOKBOOK.md) |
| 工作流程、ID、版本、設定、DoD | [DEVELOPMENT](DEVELOPMENT.md) |
| 測試指令／人工回歸 | [TESTING](TESTING.md)、[REGRESSION_CHECKLIST](REGRESSION_CHECKLIST.md) |
| 發布／故障診斷 | [DEPLOYMENT](DEPLOYMENT.md)、[TROUBLESHOOTING](TROUBLESHOOTING.md) |
| 已知限制／建議下一步 | [TECH_DEBT](TECH_DEBT.md)、[ROADMAP](ROADMAP.md) |
| 決策與 AI 任務模板 | [adr/](adr/README.md)、[AI_TASK_TEMPLATE](AI_TASK_TEMPLATE.md) |

不要把同一份幀數表、安裝指令或存檔 schema 複製到多處。摘要應連回此表指定的來源；實作與文件不一致時先核對程式及測試，修正文件或明確記為 bug。
