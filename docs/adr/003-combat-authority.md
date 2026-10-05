# ADR-003：固定 tick 與防守方裁決

Status: Accepted · Date: 2026-10-05

## Context

**IMPLEMENTED**：戰鬥以60Hz固定step、FSM、兩核心規則運作；線上由防守方視覺接觸裁決，再回傳結果。這些機制是目前手感與同步契約，不能因架構整理被換掉。

## Decision

保留`Game.frame/step`與`RiftAuthority`權限。輸入立即本機執行；意圖時間補償與pose處理維持既有模式。架構文件不稱其為完整rollback或防作弊伺服器。新ability／DOT／召喚物都須先指定效果擁有者與contact/event去重，避免兩端各扣一次HP。

## Alternatives

- 攻擊方單方扣對方HP：破壞本地招架優先需求。
- 完整rollback：需要deterministic simulation、保存／重演與新的驗證，非文件任務。
- Server authoritative：可能適用排名，但引入backend、成本、資安與部署責任。

## Consequences

好友對局信任對手，無法阻止惡意防守方謊報。所有network結果需範圍驗證／去重，仍不等於防作弊。模擬RTT測試不證明真實NAT/ICE/TURN連通。

## Verification / Revisit trigger

修改戰鬥需驗證固定step、hitstop輸入、兩核心及defender-owned resolver；涉及協議再測重複／過期結果和雙端。若新增排名、交易或永久獎勵，重新建立信任模型與ADR。
