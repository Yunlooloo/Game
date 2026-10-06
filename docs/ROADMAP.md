# 演進路線 · PLANNED／OPTIONAL

這是基於現況的建議順序，不代表遊戲作者已承諾內容、日期或商業方向。已完成項目以 [CHANGELOG](../CHANGELOG.md) 與 source 為準。

| 階段 | 狀態 | 建議成果 | 進入下一步的門檻 |
| --- | --- | --- | --- |
| Now | PLANNED | 在真實 iPhone 驗證音訊／觸控；兩裝置跨網 WebRTC；確認資源權利 | 留下裝置、版本、網路及實測紀錄，區分自動／人工證據 |
| Next | PLANNED | 第二名 Boss 的完整垂直切片：definition + controller factory + 本機 selector + 回歸 | 原赤衡可獨立選測；不複製 combat；使用既有容量helper，保持PvP100標尺 |
| Next | PLANNED | 第一個可保存解鎖，同時建 schema/migration | 舊 tutorial data 可匯入，損毀／未來版本資料不被覆寫 |
| Later | PLANNED | 第二戰場與可切換 encounter、簡單對話 | 進出會清理 projectiles/effects/input，故事資料不散落 combat |
| Later | PLANNED | 道具背包／裝備屬性／共通 status effect | 實際出現第二個可重用效果時再抽介面；save與UI一起驗收 |
| Later | PLANNED | 多敵人遇戰 | 先完成 actor identity/targeting 改造，不能把第三個actor塞進duel陣列 |
| Ideas | OPTIONAL | 商店／金錢／掉落／成就／支線／XP／難度／Localization | 由遊戲循環需要決定，不因文件列出就全部加入 |
| Ideas | OPTIONAL | Controller、fullscreen/PWA、多檔快載版、replay、排名 | 各自評估平台／網路／儲存／資安代價，再補ADR |

最值得先做的內容開發是「第二 Boss」，因為它能驗證擴充接點是否合理。最值得先做的品質工作是實機／跨網測試；目前不能用模擬結果取代這兩者。詳細債務與優先度見 [TECH_DEBT](TECH_DEBT.md)。
