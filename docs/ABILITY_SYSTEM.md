# 招式、裝備能力與擴充接口

狀態：**IMPLEMENTED** 是 `4.2.0` 的 `MOVES` 表及共用行動路徑；**PLANNED** 是內容增加後的資料接口；**OPTIONAL** 是尚未決定的技能樹等玩法。現在沒有通用 Ability class、技能等級或技能冷卻 UI。

真實來源：[src/core.js](../src/core.js) 的 `MOVES / TOOL_NAMES / B` 與 `Game.begin / tool / tickPlayer / advanceAttack / activate`。防禦結果、傷害與狀態以 [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md) 為唯一數值裁決說明。

## IMPLEMENTED：一張表，玩家與AI共用

`MOVES` 是closure-local物件，透過 `window.RIFT.MOVES` 與 `game.debug.moves` 公開作診斷；沒有模組匯入、資料檔loader或註冊API。每個actor使用 `moveName` 指向字串ID，開始時由 `Game.attackDefinition()` 建立 `move` 複本；AI角色另套用Boss起手、波次與霸體覆寫，不改共享 `MOVES`；`st / hits / wave / attackId` 是實例狀態。

| ID／短名稱 | 起手／有效／收招 tick | reach | HP／架勢 | 共鳴 |
| --- | --- | --- | --- | --- |
| `light` 輕斬 | 18／5／14 | 116 | 10／12 | 0 |
| `charged` 蓄刺 | 36／6／24 | 210 | 18／22，單次 | 0 |
| `combo` 追斬 | 11／5／19 | 137 | 11／15 | 0 |
| `chase` 疾斬 | 10／7／20 | 149 | 12／17 | 0 |
| `air` 空斬 | 12／7／18 | 140 | 12／17 | 0 |
| `thrust` 突刺 | 30／7／26 | 187 | 20／22 | 0 |
| `sweep` 橫掃 | 32／9／26 | 164 | 17／25 | 0 |
| `lightning` 雷斬 | 34／9／28 | 242 | 19／23 | 4 |
| `reversal` 返雷 | 5／12／24 | 600 | 29／35 | 0 |
| `aegis` 旋斬 | 10／7／20 | 160 | 14／21 | 0，展盾另計 |
| `flame` 焰筒 | 17／10／25 | 164 | 9／13 | 3 |
| `hammer` 重鎚 | 45／9／36 | 150 | 23／42 | 4 |
| `blink` 影襲 | 9／5／21 | 128 | 15／24 | 0，影匣另計 |
| `disc` 飛輪 | 8／2／14 | 投射物 | 5／7 | 1 |
| `cleave` 雙斷 | 43／20／33 | 166 | 15／26，每波 | 5 |
| `rift` 裂斬 | 52／30／38 | 510 | 19／25，每波 | 9 |
| `punish` 疾刺 | 10／8／30 | 190 | 24／24 | 0 |
| `triple` 連斬 | 32／42／32 | 150 | 11／15，每波 | 6 |

此表供閱讀定位；改數值以 `MOVES` 為準並同步本表與教學。`charged` 在持續按住時可延後釋放，表中的36不是強制於36tick出刀。`charged` 沒有多波，`lunge=6`。`waves` 分別為雙斷 `[0,12]`、裂斬 `[0,24]`、連斬 `[0,18,36]`；第0波在進 `ACTIVE` 時發生，其餘由 `advanceAttack()` 推進。所有多波招式 `hitWindow=6`，只在各波前6 tick可命中，波間不延長接觸。上表是玩家共用基礎值，Boss起手／波次覆寫見 [BOSS_SYSTEM](BOSS_SYSTEM.md)。

### 欄位與分派

| 欄位 | 功能 |
| --- | --- |
| `name` | HUD顯示短名，不是穩定識別符 |
| `windup / active / recovery` | FSM各段tick長度 |
| `reach / damage / posture` | 近戰接觸範圍與基礎數值 |
| `kind` | 現有 resolver／renderer 分派；`pierce` 是可格擋／招架的普通刺擊，`thrust` 才是可踏刃的危險突刺；不可任意發明而期待自動支援 |
| `cost` | `begin()` 驗證與立即消耗共鳴 |
| `waves / hitWindow` | active內各波開始時間／每波可接觸tick數 |
| `guardCancel` | 指定輕招收招經過6 tick後可轉防禦，無需命中確認 |
| `breakGuard` | 普通格擋增加防守者的架勢上限；輪盾有自己的係數 |
| `armor` | 起手受普通攻擊不轉HIT_STUN，仍承受傷害與崩解 |
| `lunge` | 有效段每tick的前進速度 |
| `chip` | 可選普通格擋穿透比例；4.2.0現有招式均未配置，裂斬普通格擋無HP傷害 |

`Game.begin()` 要求 FSM可行動、掛索中或已確認的收招取消；資源不足不進招。Phase1不能主動用雷斬／連斬；費用在開始時扣，受擊取消不退款。`free=true` 用於輪盾派生、影襲、返雷等受控路徑，不是一般UI可呼叫的作弊捷徑。

### 輕斬、蓄刺與衍生

- 按下攻擊先 `light`。玩家到第18 tick仍未放開則改為 `charged`，仍沿用已過起手時間；長按保持起手，放開且已到36 tick才進有效段。Boss由同一 `attackDefinition()` 路徑改用26／44 tick；蓄刺仍為一次接觸，沒有Boss專用波次覆寫。
- `charged` 保留穩定ID，顯示名稱改為蓄刺；`kind=pierce`、無 `breakGuard`，可普通格擋／招架。它不取代專用危險 `thrust`，也不取代消耗5共鳴、兩波命中各回復50架勢點的奧義 `cleave` 雙斷。相容性與理由見 [ADR-005](adr/005-stomp-assist-and-charged-thrust.md)。
- `RECOVERY && confirm > 0` 再攻擊接 `combo`。飛輪激活後95tick內攻擊優先 `chase`，不強制要求飛輪命中；再來才選收招追斬、空斬、輕斬。
- `light / combo / chase / air` 收招6 tick後可持續防禦取消；新按8 tick緩衝可接招架，長按只提供普通格擋。`STARTUP / ACTIVE / DRINKING` 不可防禦取消。
- 掛索中可起手攻擊／使用裝備；攻擊取代掛索狀態。飲藥仍要求落地與自由FSM狀態，掛索中不能因UI可按而喝藥。
- 玩家滑鼠右鍵先按再左鍵是奧義手勢；這只是Input adapter，不能让 Ability處理直接讀DOM事件。

### 五件裝備的特殊入口

`TOOL_NAMES` 含 `disc / flame / hammer / blink / aegis`，大廳選兩件；可在戰鬥切換目前槽位。它們是帶成本的戰鬥能力，不是背包內可堆疊 Item。

- `disc / flame / hammer`：`tool()` 直接交給同名 `begin()`；空中／掛索也可使用。重鎚從地面起手會先跳起。
- `blink`：先消耗3共鳴開啟12tick受擊窗口；命中裁決才觸發位移與免費 `blink` 影襲。沒有被打中仍消耗資源。
- `aegis`：主動消耗2共鳴進輪盾GUARD；裝備該工具時長按防禦24tick亦可展開。每60tick再消耗1，超過180tick或防禦放開進旋斬；輪盾存在時攻擊可直接派生旋斬。
- 焰筒→輕斬附火、飛輪→疾斬、輪盾→旋斬與影匣→影襲都分散在上述明確函式，尚未抽象成通用連攜圖。

共鳴上限20；一般可動流程每逢 `world.tick % 180 === 0` 回1。由於鎖定狀態有提早return，它不是與動作狀態無關的獨立資源計時器。

## IMPLEMENTED：新增一招現在需要改哪些地方

目前可直接新增的是**使用現有判定kind的招式變體**，不是只丟進JSON便完成：

1. 在 `MOVES` 增加短字串ID／短顯示名與完整tick數據；資源與招式範圍保持有限值。若多波，波次必須落在active長度內，明列各波接觸窗並讓renderer逐波重起動作。
2. 決定誰可用：玩家輸入、裝備選項、Boss決策或既有連攜。保留 `begin()` 作唯一一般起手門檻；不要直接呼叫 `activate()` 跳過成本和FSM。
3. 現有 `B` 使用16bit最高位32768，`RiftNet` 的輸入上限65535。不要無限制加新的bit；更多可選技能應規劃「槽位＋能力ID」意圖，并版本化協定。
4. 新kind才需改 `hit / collisions / activate`、`RiftRenderer` 與警報／SFX；若只是同kind不同數據，不加招式名if樹。
5. 新工具／奧義選項還需更新shell大廳、HUD名稱、loadout驗證與AI是否裝備；原有線上奧義allowlist只有 `cleave / rift`。`RiftAuthority._keyValid()` 查 `RIFT.MOVES`，但不能以此忽略其他白名單。
6. 改教學或補一個實際命中練習。測試應涵蓋揮空、命中、被擋、被招架、資源不足、起手中斷、蓄刺單次普通刺擊與危險突刺差異、多波去重／波間空檔、Boss中間波招架保留與末波反彈、線上意圖／結果。
7. 按 [DEVELOPMENT.md](DEVELOPMENT.md) build、測試并更新文檔。新增素材走 [ASSET_PIPELINE.md](ASSET_PIPELINE.md)，命名走其對應內容規範／[CONTENT_COOKBOOK.md](CONTENT_COOKBOOK.md)。

## PLANNED：共用 Ability 定義與執行實例

當第二個內容新增造成重複時，先把定義移出core為域內registry，保留既有ID兼容，不一次重命名全部招式。最小分離：

```js
// 概念模型，尚未在runtime實作。
const definition = {
  id: 'ability_tide_cut',
  cost: { resource: 'spirit', amount: 3 },
  cooldownTicks: 0,
  target: { query: 'facing_melee', reach: 150 },
  timeline: { startup: 24, active: 6, recovery: 20, waves: [0] },
  effects: [{ type: 'damage', amount: 12 }, { type: 'posture', amount: 18 }],
  presentation: { animation: 'attack_slash', vfx: 'slash', sfx: 'slash' }
};
// 施放中的實例另存 actorId / attackId / elapsed / contacts，不寫回definition。
```

`canActivate(actor,definition,context)`、`startAbility()`、`advanceAbility()`、`resolveContact()` 為足夠的小接口；玩家／Boss／敵人只共用執行層，決策來源各自獨立。若引入真實cooldown，以simulation tick計時並依pause/hitstop規則，而非 `setTimeout()`。

效果應使用有限的handler表（damage、posture、status、projectile），不把任意字串当JavaScript執行。通用Stats與Status pipeline以 [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md) 的漸進方案為準。

**OPTIONAL**：技能樹、天賦、蓄力多段、資源種類、鎖定目標、指向AOE。只有第一個具體內容需要時才增加字段和測試，避免寫一個比目前遊戲更大的技能腳本語言。
