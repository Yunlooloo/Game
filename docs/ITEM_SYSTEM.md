# 道具、裝備、數值與狀態效果

狀態：本文件的現況為 **IMPLEMENTED**；標為 **PLANNED** 的資料模型及檔案尚未存在；**OPTIONAL** 表示需要玩法需求才採用。招式成本、命中與反制的真實來源見 [ABILITY_SYSTEM.md](ABILITY_SYSTEM.md) 和 [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md)。

## IMPLEMENTED：目前有什麼

目前沒有 Inventory、商店、掉落物、金錢、裝備數值計算器或物品登錄表。介面中的「裝備」是兩個戰鬥工具槽，不能理解成 RPG 裝備系統。

| 功能 | 實作位置／資料 | 行為 |
| --- | --- | --- |
| 修復劑 | `src/core.js` 的 `fighter()`：`tonics: 3`；`src/vitals.js` 的 `beginDrink()`、`tickDrink()` | 每次新對局 3 次；站在地面且可行動、HP 未滿才可使用。進入 `DRINKING` 就扣次數，54 個模擬 tick 後回復 40 HP，上限 100；受傷打斷後不退還次數，也不治療。 |
| 工具槽 | `fighter.loadout`；`Game.loadout`；`Game.tool()` | 從 `disc`、`flame`、`hammer`、`blink`、`aegis` 選兩件；使用工具消耗 `spirit`，不是從背包消耗物品數量。 |
| 奧義 | `fighter.art`；`MOVES` | `cleave`／`rift` 擇一；共享攻擊狀態機。 |
| 共鳴 | `fighter.spirit` | 初始／上限 20；符合更新條件時，每 180 tick 回復 1。不是跨關卡貨幣。 |
| 燃燒 | `fighter.burn`；`Game.hit()`、`tickPlayer()`；`RiftFSM.postureRate()` | 火焰或附火命中設定 240 tick；倒數能被後續命中重新設為 240，沒有多層堆疊。每次倒數到 45 的倍數傷害 1.5，架勢回復乘 0.25。 |
| 附火 | `fireReady`、`fireBlade` | 焰筒使用後有銜接輕斬的時限，成功附火持續 600 tick；不是永久武器升級。 |
| 帶電 | `charged` | 空中接雷寫入數值 `180`；目前 `tickPlayer()` **不對它倒數**，實際持續到返雷、落地受傷或復燃清除。不能把該數值當作已實作的 180 tick 到期時間；它不是通用元素抗性。 |
| 反應與保護 | `invuln`、`stun`、FSM 狀態 | 無敵、受創、倒地與復燃已存在，但分散在既有戰鬥流程，沒有通用 EffectContainer。 |

所有時間以上述 **60 Hz 模擬 tick** 為單位；hitstop 會凍結角色更新，不用渲染幀或 `setTimeout()` 驅動狀態傷害。教學的補血／補資源是 `RiftTutorial.beforeStep()` 明確的訓練特例，不應複製到正式道具行為。

目前 HP、架勢都以 0–100 為約定，`vitals.js`、`fsm.js`、HUD、教學及網路驗證都有此假設。只替角色加一個 `maxHP: 300` 並不能安全增加生命上限。

## PLANNED：先落地最小道具模型

第一個真正背包需求出現時，再新增 `src/content/items/` 和 `src/inventory.js`。不要先建立空的物品繼承樹。`ItemDefinition` 是不可變內容；`InventoryEntry` 是玩家持有量，兩者分開。

以下是**設計草案，現有程式不會自動讀取**：

```js
// 未來 src/content/items/repair_tonic.js
const repairTonic = {
  id: "item_repair_tonic",
  kind: "consumable",
  name: "修復劑",                 // 之後可遷移為 nameKey
  description: "在安全距離完成修復。",
  icon: "ui_repair_tonic",         // 素材 ID；尚無 icon resolver
  maxStack: 3,
  rarity: "common",
  price: null,                   // 無商店時不製造隱含經濟規則
  use: { abilityId: "ability_repair_tonic" }
};
const entry = { itemId: "item_repair_tonic", quantity: 2 };
```

分類先使用 `consumable | equipment | quest | material | key` 欄位；只有真的需要個別耐久、附魔時才增加唯一 `instanceId`。物品描述、稀有度與售價不能決定戰鬥效果，效果應引用共享 Ability／Effect。掉落屬於 Encounter 的 Reward Definition，不能由物品模組自行判斷 Boss 死亡。

首次接入順序：

1. 新增資料與 `src/content/items/registry.js`，檢查 ID 唯一、數量界線、引用存在。
2. 新增小型 `Inventory` 純邏輯模組，處理 `canAdd/add/remove` 的容量及原子性。先測滿堆疊、未知 ID、負數、非有限數值；不要讓 UI 任意更改陣列。
3. 用一個 adapter 把「使用修復劑」接回 `RiftVitals.beginDrink()`／`tickDrink()` 的既有時機。選定唯一數量真實來源後再移除重複的 `tonics`，不能同時讓兩邊扣量。
4. 決定對局起始補充還是跨關卡庫存；兩者是玩法決策。預設保持當前每局 3 次，直到有明確要求。
5. 道具 UI 發出使用請求，由 FSM／Ability 驗證；受創中不能藉 UI 繞過 `canAct()`。連線道具結果仍由受擊方處理。
6. 在 `scripts/build.py` 加入新模組及正確載入順序，補測試，最後才加入持久化；[SAVE_SYSTEM.md](SAVE_SYSTEM.md) 規定格式與遷移。

## PLANNED：Equipment 與 Stat Modifier

武器、防具、飾品先用 `slot` 定義，必要時共享 `ItemDefinition`。裝備能力不使用 `if (weapon === ...)` 堆疊在 `Game.hit()`。

```js
// 設計範例，並非目前可裝備的內容
const ironBand = {
  id: "item_iron_band", kind: "equipment", slot: "accessory",
  modifiers: [{ stat: "postureDamage", op: "add", value: 2 }]
};
```

初版計算順序固定為 `clamp((base + sum(add)) * (1 + sum(percent)), min, max)`；這裡 `percent: 0.1` 表示 +10%，不是 10。記錄每個 modifier 的 `sourceId`，換裝／效果消失時移除來源，再從 base 重算，不能把倍率反覆乘回上一次結果。乘法群組、優先級覆寫、暴擊等列為 **OPTIONAL**；有需求時需先制定順序與測試，不現在建立通用公式語言。

`Stats` 未落地前，優先沿用既有 `MOVES` 數值。若要改成任意 HP 上限，需同時改 HP 比例的架勢門檻、治療上限、復燃、HUD 百分比、AI 判斷、教程及封包約束；先做相容性遷移，再開放 Boss 資料設定。

## PLANNED：共用 Status Effect 生命週期

玩家與 Boss 已使用同一 fighter 資料和 `RiftVitals`。新的中毒、冰凍、流血、攻擊上升／防禦下降不應各做一套。

| 欄位 | 意義 |
| --- | --- |
| `effectId`、`sourceId` | 穩定定義 ID 和此次施加來源；不得以顯示名稱當鍵。 |
| `remainingTicks`、`nextTick` | 模擬時鐘；不使用 DOM timer。 |
| `stacks`、`maxStacks` | 明確上限；無堆疊需求預設 1。 |
| `refreshPolicy` | `replaceDuration`、`extendDuration` 或 `ignore`；不得靠陣列插入順序決定。 |
| `tickInterval`、`effect` | 可選 DOT／HOT 或 modifier；只允許登錄過的 effect kind。 |
| `removeOn` | 對局重開、復燃、死亡等清除時機。 |

生命週期：`apply → validate → tick → refresh/stack → expire → remove`。同一 tick 的排序、移除後是否還有尾端 DOT、再次施加是否重置 pulse 時鐘，都要在效果定義及測試中明示。

先將**現有燃燒**包成新模型的第一個案例，保持其 240 tick／45 tick／1.5 傷害／0.25 回復倍率不變；比對原行為後才增加第二種效果。`STUNNED` 等 FSM 反應不能被狀態容器任意寫成 `IDLE`：DOT 呼叫 vitals，受創／破架勢仍交由 FSM。復燃目前清除 `burn`、`charged`、`fireBlade`，新容器必須保留相同清除語意。

## 系統互動與驗證

**PLANNED**：Input/UI → 使用請求 → Inventory 成本驗證 → 共用 Ability/FSM → 受擊方 Combat → Vitals/Effect → 顯示／音效；Encounter 成功後的獎勵 → Inventory → Save。只有成功的 authoritative 結果可以觸發掉落，重送封包不能重複領獎。

新增內容的操作入口見 [CONTENT_COOKBOOK.md](CONTENT_COOKBOOK.md)。最低驗證應涵蓋：使用失敗不多扣資源；喝藥完成／受傷打斷／倒地；裝備替換無數值漂移；DOT hitstop 暫停、復燃清除；背包與 save 遷移；舊 Boss、教學與連線反制不變。尚無庫存測試時，不應在結果報告寫「Inventory 測試已通過」。
