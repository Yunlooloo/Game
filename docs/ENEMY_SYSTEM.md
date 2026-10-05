# 敵人系統與多目標演進

狀態：**IMPLEMENTED** 目前是雙人決鬥的共享 fighter；**PLANNED** 是新增普通敵人時的邊界；**OPTIONAL** 表示內容選項。目前沒有 Normal Enemy、Elite 類別、刷怪表或同場多敵人。

## IMPLEMENTED：共享 actor，不存在敵人繼承樹

[src/core.js](../src/core.js) 的 `fighter(id,x,loadout,art)` 建立普通 JavaScript 物件。玩家、AI赤衡、本機第二玩家、遠端副本與教學陪練都使用同一組 HP／架勢／雙核、FSM、攻擊、物理與動畫欄位。差異在**控制來源**：鍵盤／滑鼠／觸控、`RiftAI.input()`、網路意圖、副本更新、或 `RiftTutorial.beforeStep()` 的練習指令。

這種重用是現有優點；新增敵人不應复制一套 `PlayerCombat`、`BossCombat`、`EnemyCombat`。目前也不是 ECS、Entity Manager 或完整 component 架構。

| 可直接共用 | 現有假設限制 |
| --- | --- |
| `RiftFSM` 控制可動與鎖定 | 狀態枚舉固定，Defeat Rule 是雙核 |
| `RiftVitals` 傷害、架勢、飲藥、復燃 | HP固定100，不接受獨立maxHP |
| `MOVES`、`begin / hit` | 取敵方式多為 `world.players[1-id]` |
| `physics / grapple` | 固定4000寬場地、1080底部與兩位角色坐標 |
| 渲染、音效、粒子 | 美術和UI多以玩家ID 0／1決定 |
| AI輸入bitmask | `RiftAI` 只有一個對手參數，不是群體協作 |
| 網路防守權限 | 兩端localId/remoteId固定0／1，沒有AI擁有者協定 |

Boss 的具體實作與第二位可選Boss流程，以 [BOSS_SYSTEM.md](BOSS_SYSTEM.md) 為準。新增單個可選精英，仍放在 `players[1]`，可避免過早改多目標引擎。

## PLANNED：Normal、Elite、Boss 用組合定義

需要普通敵人關卡時，先建立小型 `EnemyDefinition`，而不是多層抽象父類。示例字段（尚無 runtime loader）：

```js
const definition = {
  id: 'enemy_foundry_guard',
  rank: 'normal',                 // normal | elite | boss
  statsProfileId: 'duelist_v1',
  abilityIds: ['light', 'thrust'], // 現有兼容ID，未來再統一前綴
  controllerId: 'patrol_guard',
  presentationId: 'foundry_guard',
  defeatRule: 'hp_zero',          // 這個規則尚未實作，不能直接套到現版Vitals
  rewards: []
};
```

| 概念 | 共用能力 | 可選差異 |
| --- | --- | --- |
| Normal | actor生命週期、受擊、行動、移動、能力 | 較少招式、簡單巡邏；是否直接HP歸零死亡由設計決定 |
| Elite | 同上 | 更強反制、指定技能或一段特殊機制；不硬綁更多血量 |
| Boss | 同上 | 階段、特殊規則、遭遇音樂、專屬場地／獎勵宣告 |

Controller 只讀感知資訊並回傳 action intention；`CombatResolver` 決定是否有效；`Encounter` 持有出生／清場生命週期；`Progression` 消費確認的擊敗事件發獎勵。渲染只讀presentation資料。事件接口與目前尚無EventBus的現況見 [GAME_SYSTEMS.md](GAME_SYSTEMS.md)。

## PLANNED：同場多敵人前一定要做的遷移

**不能只把第三個 actor push 進 `world.players`。** 以下接點現在假設恰好兩個角色：

1. `tickPlayer(p,bits,enemy)` 的朝向、斷決、蹬踏、掛索戰鬥與回血距離，需要明確 `TargetQuery`（最近／鎖定／受擊來源）。
2. `collisions()` 的 `const [p0,p1]` 交鋒、`1-t.id`近戰／投射物目標，需要改為有效目標集合；同一攻擊波仍按 `targetId` 去重。
3. `Game.frame()`／`step()`、`buffered`與`rawPrev`只能處理兩人；輸入控制器改依entity ID存取，不以陣列index當身份。
4. `RiftVitals.takeNode()` 必須先拆出 defeat rule；保留PvP／Boss雙核，普通敵人的HP歸零死亡若需要另走規則，不能修改全部角色。
5. HUD、結果、分數與鏡頭需決定主焦點、Boss条與普通敵人顯示。不要讓所有敵人都擠成主HUD列。
6. 線上權限須明定AI由哪端模擬／裁決；現有P2P僅雙人對決，先把多敵人限制於local mode較安全。
7. 效能測試碰撞數量與AI觀察成本；目標少時普通迴圈即可，真正超出預算再加空間分區。

每一步維持二人模式回歸，完成後才能增加群體Encounter。場景與遭遇的資料責任見 [LEVEL_SYSTEM.md](LEVEL_SYSTEM.md)。

## 如何新增與測試

- **現在新增一個可選敵人**：沿用 [BOSS_SYSTEM.md](BOSS_SYSTEM.md) 的定義／工廠最小接口；可以先減少招式與反應能力當練習對手。不要宣稱已有關卡怪物系統。
- **將來新增關卡普通敵人**：先完成上述多目標遷移，再建立 `src/content/enemies/<id>.js`（PLANNED路徑）、域內registry一筆、controller或共用profile、presentation資源與Encounter出生配置。
- **驗證**：重複出生／移除不留攻擊與投射物；同波只打同目標一次；已死亡目標不再行動；掉落單次發放；暫停不推進；舊Boss雙核不變；同屏/PvP不被新defeatRule影響。測試與命令統一在 [TESTING.md](TESTING.md)。

**OPTIONAL**：陣營、仇恨值、巡邏圖、脫戰回歸、友軍、掉落、刷怪Director。先為一個具體Encounter做最少的可測行為，再決定是否抽成共用system。
