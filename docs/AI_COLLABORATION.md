# 多人／多 AI 協作協定

**IMPLEMENTED 維護規則**：適用 Codex、ChatGPT、Claude、Gemini、Copilot、其他 agent 與人類；不依賴任何一家工具的聊天記憶。本文件描述工作方式，不表示未來的 runtime 系統已存在。[AGENTS](../AGENTS.md) 是主要行為入口；本文件提供詳細協作程序。

## 接手：Repository 是記憶

假設 `Past Chat Context = Lost`。修改前依序讀：

1. [README](../README.md)：遊戲與操作入口。
2. [AGENTS](../AGENTS.md)：規則與不可破壞的契約。
3. [AI_HANDOFF](AI_HANDOFF.md)：任務導航。
4. [PROJECT_STATUS](PROJECT_STATUS.md)：即時現況，接著讀 [CURRENT_HANDOFF](CURRENT_HANDOFF.md) 的最新接力棒。
5. [WORK_LOG](WORK_LOG.md)：近期實質任務的原因與未完成部分。
6. [ARCHITECTURE](ARCHITECTURE.md)、相關 system 與 ADR。

同時檢查 `git status --short`、`git log -5 --oneline`：上一個任務是否完整？有沒有未提交工作？是否存在 `Migration in progress`？依任務範圍跑 baseline check/test。不要因前一份交班寫 PASS 就省略本次必要驗證。

若文件與程式矛盾：查 Git history → implementation → ADR → 判斷真實狀態，修正文件或記為缺陷。不得單凭某段舊聊天、過期報告或自己偏好的寫法推翻已運作架構。

## 修改前 Impact Analysis

非微小修改先寫短分析，暫存在任務計畫即可；有長期價值的結論須進 WORK_LOG／ADR：

```text
Target system / owner:
Current behavior and source symbols:
Requested outcome:
Affected systems / modes / platforms:
Existing pattern / registry / utility / helper found by search:
Relevant ADR and preserved invariants:
Save / protocol / deployment compatibility:
Impact on existing Boss / Stage / Item:
Smallest change and alternatives:
Tests / rollout / rollback:
```

先 `rg` 搜尋同概念與呼叫者，確認是否已有 utility、manager、registry、event、config。不得在已有同責任模組旁另建 `*Manager`／`*V2`；不同責任需明確命名與說明。決策順序是「能運作嗎 → 能理解嗎 → 足以支援這項需求嗎 → 有真實問題嗎」，不是換成自己的慣用 framework。

## 系統 Ownership、依賴與擴充

每件事有一個主要負責者，見 [GAME_SYSTEMS](GAME_SYSTEMS.md) 的 ownership 表。現在 `Game` 仍有UI／combat耦合；目標依賴方向為 Content → Gameplay → Core，UI 讀 state 或發 intent、Boss 輸出 intent、Combat 產生已確認結果。這是演進方向，不可謊稱現在已全面事件化。

- Registry 只做 `ID → Definition` 及驗證，行為由小型 controller／effect module 組合；不塞入整個 engine。
- 優先組合 stats／ability／behavior／effect，不建立深層敵人繼承樹。只在真正重複時抽象。
- 顯示名稱改變不改 stable ID；規範見 [DEVELOPMENT](DEVELOPMENT.md)。
- 新的全域 `window.*` 必須有唯一責任、載入順序與生命週期；延續目前受控的 `Rift*` 接點，不把每個 Boss、UI、save 都做全域 singleton。
- 內容特例封裝在對應內容模組。沒有硬性的 special-case 數量上限；若新增同型內容持續需要修改 `frame/hit/Main/global state`，記錄 **Architecture Smell**，改善共用接點。
- 新增Boss不授權順便重寫Save/UI/framework。Observe → Document → Propose → Incrementally Improve；Boy Scout Rule 是讓所碰部分更清楚，不是每次重寫引擎。

Extension point 的 files／fields／registry／assets／tests／不該碰的核心見 [CONTENT_COOKBOOK](CONTENT_COOKBOOK.md)。第二項同類內容應比第一項更容易；若成本反增，下一步優先檢查接點，不再複製一套系統。

## 並行協作與遷移

多 agent 共用工作樹時先指定檔案 ownership，交代允許修改範圍、介面及產物；不要同時編輯相同檔案或各自 build/commit。整合者負責重新測試組合後的版本。尊重已有未提交修改，禁止用 reset/checkout 清除他人工作。

新舊系統並存必須在 PROJECT_STATUS／CURRENT_HANDOFF 明列：

```text
Migration in progress
Old: <舊入口與使用者>
New: <新入口與使用者>
Current Usage: <哪些模式／內容走哪條路>
Remaining Migration: <未完成範圍、測試及移除條件>
Rollback: <如何回到已驗證版本>
```

不能只提交不被載入的 registry 後稱架構完成。若先交付文件方案，明列 PLANNED；不要留下看似啟用但其實無呼叫者的 runtime skeleton。

## 完成後 Self Review 與交班

- 是否重複建立系統、混淆ownership、增加無必要抽象？
- 同類內容再加第二項是否更容易？若修改多個核心，是否有必要理由／Smell記錄？
- 文件與目前source一致嗎？是否把未實作範例或mock誤當現況？
- build、相關tests、smoke、部署驗證是否來自本次？未測／失敗是否明列？
- PROJECT_STATUS、CURRENT_HANDOFF、WORK_LOG 是否更新？架構變更是否更新 ARCHITECTURE／ADR？

實質任務結束：更新現況快照、**覆寫**最新交班、在工作日誌增加一筆 Why／影響／未完成部分。CHANGELOG只處理版本／玩家可見資訊及有意義的維護變更，不能取代WORK_LOG。微小typo／格式不單獨寫工作日誌。

最終回覆附 Handoff Summary：Finished／Current Architecture／Important Decisions／Known Issues／Next Safe Step／Do Not Change Casually／Read These Files First，重要內容同步 CURRENT_HANDOFF。不能讓新決策只存在回覆裡。

## 文件 Ownership

| 文件 | 唯一主要責任 | 不應放什麼 |
| --- | --- | --- |
| README | 對外入口 | 完整系統規格 |
| AGENTS／本協定 | 開發行為、協作與交接規則 | 每次任務的歷史 |
| PROJECT_STATUS | 現在能做什麼、架構健康度 | 長篇歷史／完整已知bug規格 |
| CURRENT_HANDOFF | 最新一棒、未完成部分、證據入口 | 多次交班累積 |
| WORK_LOG | 實質任務的Why／架構影響／脈絡 | 每個commit或typo |
| ARCHITECTURE／system docs | 邊界、契約、現有／擴充接點 | 重複發布指令 |
| ADR | 重要決策的理由／替代方案 | 逐行修改流水帳 |
| CHANGELOG | 版本變更 | 未核實未來承諾 |
| TECH_DEBT | 已知問題、優先度、完成條件 | 假稱已修復的方案 |
| ROADMAP | Now／Next／Later／Ideas | 硬性發布承諾 |
| VALIDATION | 當次實測、工具版本、範圍 | 永久通過保證 |

**OPTIONAL**：重大feature複雜到跨多系統時才新增 `docs/features/<feature>.md`，記錄該feature整合與驗收，連回各system／ADR，不另造第二套真實來源。一般新增一個Boss不必多造一份feature文件。
