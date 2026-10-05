# ADR-002：以內容需求逐步資料化

Status: Accepted · Date: 2026-10-05

## Context

**IMPLEMENTED**：現有單Boss、雙actor、固定地圖，`MOVES` 已是小型資料表；沒有inventory、story或stage registry。未來有擴充需求，但一次實作全部框架會增加無法驗證的複雜度。

## Decision

**PLANNED 實作路線**：新增第二Boss時抽其definition與controller factory；共用既有FSM／input／combat。新增實際stage/item/story內容時，各自建立明確小型registry與validation。先用原生JS object（可含已註冊behavior ID），需要外部工具時再評估JSON；不允許內容字串`eval`。穩定ID與顯示文字分離。

本次先寫資料契約、接點、cookbook，不引入沒有使用者的runtime模組。

## Alternatives

- 在核心堆疊大量boss-name條件：容易重複combat及漏測。
- 通用ECS、DI、plugin loader、抽象工廠層：現況無需求證明，增加接手成本。
- 全部資料改JSON：無工具需求時只是多一層解析與打包，不自動帶來低耦合。

## Consequences

未來第一項內容需要做小型接點，不是零程式工作；之後同型內容應主要新增definition。新的module仍需在build明列。缺失ID／未知effect／phase循環應在開發測試失敗，不能悄悄fallback成另一Boss。

## Verification / Revisit trigger

以第二Boss能共用resolver且赤衡回歸通過驗證設計。當第三actor或不同maxHP真正出現時，先重訪跨模組契約而非只放寬definition欄位。
