# Architecture Decision Records

**IMPLEMENTED**：本目錄是重大取捨的紀錄來源。Accepted 代表本次接受的維護規則，不代表所有 PLANNED 擴充已實作。新需求推翻決策時建立新 ADR，將舊記錄標 Superseded 並互連，不刪掉理由。

| ADR | 狀態 | 主題 |
| --- | --- | --- |
| [001](001-source-and-single-file.md) | Accepted | 版控來源、可重現 build、保留單檔發行 |
| [002](002-incremental-content.md) | Accepted | 由真實內容需求導入資料化，而非預造框架 |
| [003](003-combat-authority.md) | Accepted | 保留固定 tick 與防守方裁決，明列信任限制 |
| [004](004-readable-rhythm-and-boss-capacity.md) | Accepted；部分由005取代 | 招架節奏、Boss三核／容量接點仍有效；005取代蓄斬雙波與協議4選擇，保留004歷史理由 |
| [005](005-stomp-assist-and-charged-thrust.md) | Accepted | 蹬踏緩衝／位移輔助、單次普通蓄刺與手機操作；協議5，保留003裁決邊界 |

新增格式：

```markdown
# ADR-NNN：<決策名稱>
Status: Proposed / Accepted / Superseded
Date: YYYY-MM-DD
## Context
## Decision
## Alternatives
## Consequences
## Verification / Revisit trigger
```

凡是會更改單檔產物、存檔格式、網路裁決、多人 entity 模型或依賴／部署架構，應留下 ADR。一般文案、數值調整不需要 ADR。
