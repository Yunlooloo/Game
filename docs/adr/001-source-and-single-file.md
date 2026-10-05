# ADR-001：版控開發來源，保留單檔發行

Status: Accepted · Date: 2026-10-05

## Context

**IMPLEMENTED 原況**：GitHub 只有約14.3MB `index.html`；JS 模組、音樂原檔、build和tests只在雲端工作區。可直接遊玩，但新的clone無法重現或安全修改。單檔與無runtime素材依賴是既有交付契約。

## Decision

將既有來源原樣納入 `src/`，PeerJS 放 `vendor/`、原MP3放 `assets/`；用Python標準函式庫的顯式build串接。生成的 `index.html` 仍提交根目錄供Pages `main:/` 發布。以 `--check` 和產物hash證明同步；本次不改runtime版本及行為。

## Alternatives

- 只加文件：不能解決來源遺失與不可重建。
- 立即改ESM／bundler／外部assets：增加runtime及部署變更，不是本次必要條件。
- 每次從巨大HTML反向解包：易遺漏module順序、編碼與資源來源，難維護。

## Consequences

Repo會同時保存MP3原檔與HTML內base64，容量增加；換來清楚來源與可離線交付。build不得包含本機絕對路徑、時間戳或secret。新增module必須明列次序；build/check作為產物一致性契約。`.gitattributes` 固定LF，並僅對原樣保存的 `render.js`／PeerJS豁免既有尾端空行檢查，保留原始bytes；其他whitespace檢查仍啟用。

## Verification / Revisit trigger

本次重新產出的HTML須與4.0.2原artifact逐位元一致。若手機載入體積成為量測過的瓶頸，再評估可選多檔發行，而非偷偷破壞單檔預設。
