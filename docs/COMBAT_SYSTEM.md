# 戰鬥系統

狀態：**IMPLEMENTED** 的內容依 `4.0.2` 程式；**PLANNED** 是演進接口，**OPTIONAL** 須有玩法需求才實作。幀均指 60 Hz 邏輯 tick，不能換算為 `requestAnimationFrame` 次數。

真實來源：[src/core.js](../src/core.js) 的 `MOVES`、`Game.begin / advanceAttack / collisions / hit / counter / execute`；[src/fsm.js](../src/fsm.js) 的 `RiftFSM`；[src/vitals.js](../src/vitals.js) 的 `RiftVitals`。招式定義與新增程序見 [ABILITY_SYSTEM.md](ABILITY_SYSTEM.md)，Boss 決策見 [BOSS_SYSTEM.md](BOSS_SYSTEM.md)。

## IMPLEMENTED：從輸入到結果

```mermaid
flowchart TD
    Input[輸入 bitmask 與邊緣緩衝] --> Tick[Game.tickPlayer]
    Tick --> Start[begin: 驗證 FSM 與共鳴消耗]
    Start --> Clock[advanceAttack: STARTUP → ACTIVE → RECOVERY]
    Clock --> Activate[activate: 刀光或 projectile]
    Clock --> Collision[collisions: 只裁決 owns 的防守角色]
    Activate --> Collision
    Collision --> Defense[hit: 依序評估位移與反制]
    Defense --> Vitals[RiftVitals / addPosture]
    Vitals --> Down[STUNNED: 倒地窗口]
    Down --> Finish[execute / takeNode]
    Finish --> Revive[第一核: REVIVING 與 Phase 2]
    Finish --> End[第二核: DEAD 與 ended]
    Defense --> Feedback[音效 / 粒子 / hitstop / 教學觀察]
    Defense --> Net[線上: 防守方回傳裁決]
```

`activate()` 生成表現與投射物，不直接扣對手 HP。近戰接觸集中在 `collisions()`，其迴圈以防守者為單位；`hit()` 入口再次檢查 `owns(target)`。本機模式同一個引擎擁有雙方，線上各端只擁有自己。例外傷害來源是自己的燃燒、帶電落地，以及主機發布的天雷位置；這些仍只修改本端擁有的角色。

### 命中範圍、波次與攻擊生命週期

- 近戰：攻擊者須為 `ACTIVE`；`dx = (target.x - attacker.x) * facing` 在 `[-32, reach)`，垂直差預設 `< 100`。重鎚垂直容許 `< 150`，返雷 `< 700`。目前沒有真正的逐骨骼 hitbox、牆遮擋或多目標搜尋。
- 飛輪：速度 18 px/tick，存活 100 tick；接觸為水平差 `< 27`、相對角色中心 `y - 43` 的垂直差 `< 43`。命中後消失；`reflected` 欄位存在，但沒有反射飛回的行為。
- `p.hits` 避免一個 active 波次重複打同一人；`waves` 開啟新波次時清空。攻擊 `attackId`、波次 `wave`、`contactId` 讓線上確認去重。不可只靠畫面動畫判斷一次命中。
- 雙方同時揮普通 `slash / cleave` 且朝向、距離有效時，先處理交鋒：每個本端防守者增加 8 架勢，凍結 6 tick；不是完美招架。先快照雙方攻擊，避免一人的崩解清掉另一人的判定。
- 開始別的狀態時，`RiftFSM.enter()` 清除已取消的 `move / attackId / hits / charge / confirm`。不要直接設 `state` 繞過它；網路 replica 與教學重置的直接賦值是既有受限邊界。

### 防禦裁決的實際順序

`Game.hit()` 的順序是玩法規則，調整順序即是平衡變更：

| 優先序 | 條件 | 結果 |
| --- | --- | --- |
| 1 | 非本端角色、死亡、`EXECUTING / REVIVING / DEAD` | 不裁決 |
| 2 | `blinkWindow > 0` 且未倒地 | 消耗影匣窗口，移至背後，自動 `blink` 出刀，12 tick 無敵 |
| 3 | 突刺＋朝攻擊者方向墊步 | 踏刃；攻擊者 +35 架勢、`BLADE_PINNED` 42 tick |
| 4 | 橫掃＋空中且腳位高於攻擊者 28 px | 躍過，無 HP 傷害 |
| 5 | 雷斬＋空中 | 接雷：`charged = 180`，不立即扣血 |
| 6 | 普通攻擊＋`invuln > 0` | 閃避；危險招式不受一般墊步無敵化解 |
| 7 | 普通攻擊＋有效招架窗口＋正面或輪盾 | 完美招架 |
| 8 | 普通攻擊＋格擋＋正面或輪盾 | 普通格擋 |
| 9 | 以上皆否 | `RiftVitals.hurt()`，再套用燃燒、擊退、命中回饋 |

`thrust / sweep / lightning / reversal` 都屬危險招式：目前不可普通格擋，也不可完美招架。輪盾是全方向的普通防禦，**不是所有危險招式無條件無效化**。天雷另外在 `weatherTick()` 處理，輪盾可擋地面天雷；不能將此例外擴張成所有雷斬都能擋。

### 招架與格擋

- `GUARD` 輸入上升緣建立 `DEFLECT`，狀態鎖 12 tick。有效窗口 `max(4, 12 - 2 * guardSpam)`；距上次按下 `<= 24` tick 時累加 spam，上限 4；間隔更長重置為 0。
- 有效窗口倒數與狀態鎖不同；重複按鍵不能取消正在起手的攻擊。正面條件 `(attacker.x - target.x) * target.facing >= -16`，轮盾忽略朝向。
- 完美招架不扣自身 HP、不增加自身架勢；反給攻擊者 `move.posture * 1.55 + 7` 架勢，普通反彈硬直 18 tick，重鎚 64 tick；觸發雙端各自 8 tick hitstop。
- 普通格擋一般不扣 HP：架勢增加 `move.posture * 1.35`。`breakGuard` 招式對普通格擋增加 100，直接崩解。轮盾優先改成 `move.posture * 0.2`，因此輪盾可承受破普通格擋的攻擊。
- 裂斬 `chip = 0.45`，普通格擋仍承受 `19 * 0.45 = 8.55` HP／波；完美招架仍無傷。這不是防禦力或元素抗性公式。

### 蹬踏、返雷、取消

蹬踏由 `tickPlayer()` 的第二次跳躍上升緣判斷：玩家已在空中、在對手上方 25–215 px 內、水平差 `< 115`、本次未踩過，且對手橫掃仍在 `STARTUP / ACTIVE`。成功反給 30 架勢與 35 tick 反彈，玩家再次向上彈跳。這個特殊反制也是防守者自身輸入循環提出。

接雷後在空中攻擊會清掉電荷並發動 `reversal`；帶電落地則自身受 26 HP、25 架勢與 75 tick 硬直。`charged` 現在是帶電旗標數值，沒有一般逐 tick 的 180→0 倒數；只有釋放、落地、復燃等路徑清除。不要誤把它文件化為三秒自然到期。

命中後 `confirm` 開啟收招取消：本機命中 28 tick、普通格擋 22 tick、同時交鋒 25 tick；線上 `HIT / BLOCKED` 回覆給 28 tick。`RECOVERY && confirm > 0` 可接 `combo` 或墊步。完美招架會把攻擊者改為 `RECOIL`，不能當成一樣的連招確認。飛輪激活便建立 `chase = 95`，**不是只有飛輪命中才可疾斬**；教學額外要求兩者確實命中才算完成課程。

## IMPLEMENTED：HP、架勢、修復與雙核

目前所有角色 HP 與架勢上限皆固定 **100**，沒有 `maxHP` 或 Stats 容器。

| 當前 HP | 自然架勢恢復速率 |
| --- | --- |
| `>= 75` | 35／秒 |
| `50 <= hp < 75` | 15／秒 |
| `< 50` | **0／秒** |

`RiftFSM.postureRate()` 另要求距最近接觸至少 12 tick (`peace >= 12`)，排除倒地、執行、復燃與死亡。持續 `GUARD` 且水平距離 `> 350` 時 ×2.5；燃燒 ×0.25；AI 第二階段 ×1.2。低 HP 的 0 在乘數前返回，不能被任何上述倍數變成非零。`tickPlayer()` 的提早返回也使飲藥與受擊鎖定時不進行常規恢復。

`RiftVitals.beginDrink()`：落地、可自由行動、HP <100、至少一劑才可使用；立即消耗 1 劑並鎖定 `DRINKING` 54 tick，完整完成後 +40 HP，上限 100。受傷／反應轉移清空 `healPending`，已消耗的藥不退還。初始 3 劑，第一核復燃不補藥。

`hp <= 0` 或 `posture >= 100` 只觸發 `down()`：HP 降到至多 15、架勢 100、清掉橫向速度／墊步／掛索／防禦，進入 `STUNNED` **240 tick／4 秒**。空中仍有重力。重複打已倒地者不延長原有狀態計時。窗口結束 `recoverDown()` 回到 15 HP、35 架勢與 `IDLE`，沒有自動扣核。

貼身攻擊觸發 `execute()`：本機水平 `< 135`、垂直 `< 115`，且目標 `vulnerable()`。`takeNode()` 每次只奪一核：

1. 剩 1 核：HP=100、架勢=0、Phase=2、`REVIVING` 與 invuln=90 tick，清除燃燒／帶電／附火等；對手震退，繼續同一場。
2. 剩 0 核：`DEAD`，`finisherScene()` 將 `world.phase='ended'`、增加場次比分，約 1.6 秒後顯示結果。

不要讓任意「傷害事件」直接觸發勝利，或讓每幀輸入在倒地時保留逃跑速度。

## IMPLEMENTED：狀態效果與傷害限制

| 現有概念 | 實作位置與語意 |
| --- | --- |
| 燃燒 DOT | `burn=240`；`tickPlayer()` 倒數後每逢 `%45===0` 受 1.5 HP；重複命中覆寫時長，不疊層；架勢恢復 ×0.25 |
| 附火 | 焰筒開始時 `fireReady=180`，其間發動 `light` 轉 `fireBlade=600`；命中可施加燃燒 |
| 硬直 | `HIT_STUN / RECOIL / BLADE_PINNED / STUNNED` 明確狀態；一般命中18、重鎚32、雷斬75、返雷110 tick |
| 霸體 | 只有 `STARTUP && move.armor` 抵抗普通受擊狀態中斷；仍扣 HP／架勢，崩解仍中斷 |
| 擊退 | 普通命中速度6、重鎚10，`HIT_STUN` 每tick乘0.75；倒地強制清零 |
| 恢復 | 修復劑單次延遲 +40；雙斷每個成功命中清除自身 **50 架勢點**，不是當前值50% |
| 無敵 | 墊步7 tick，影匣成功12 tick、復燃90；一般危險招式繞過墊步 invuln，復燃狀態則拒絕接觸 |

目前沒有物理／魔法區分、暴擊、護甲、抗性、毒／冰／流血、HOT、通用 Buff 容器、裝備增傷、友軍、爆炸半徑或碰撞分層；`rift / reversal` 是長範圍近戰條件，不是通用 AOE 系統。

## IMPLEMENTED：線上裁決與時序

[src/authority.js](../src/authority.js) 的 `RiftAuthority` 驗證擁有者、回合、ID、型別與數值界限；[src/net.js](../src/net.js) 是可靠 JSON DataChannel transport，通訊版本 `3`（與遊戲版本無關）。

```mermaid
sequenceDiagram
    participant A as 攻擊者端
    participant D as 防守者端
    A->>A: begin（本地立即起手）
    A->>D: ATTACK_START（attackId / startTick / timestamp）
    D->>D: receiveAttack 跳過估計已過起手 tick
    D->>D: 本地視覺接觸，hit 裁決
    alt 完美招架或反制
        D->>D: 即時回饋，預測遠端反彈
        D->>A: DEFENSE_SUCCESS
        A->>A: 驗證去重，recoil 與自身架勢更新
    else 命中或格擋等
        D->>D: 自身 HP／架勢更新
        D->>A: HIT_CONFIRMED
        A->>A: 更新防守者顯示副本，開啟確認取消
    end
```

- `_elapsed()` 用 `Date.now() + clockOffsetMs - timestamp`，換成 60 Hz tick，截在 0–30 tick；不是單純把不同裝置時鐘直接相減。Ping/Pong 用 RTT 中點估計偏移，非完美時鐘同步。
- `publishState()` 最多20 Hz；`receivePlayerState()` 預測最多12 tick，位置誤差較小時按0.65插值，大於170px時貼齊。只改遠端副本，不倒退已由意圖建立的攻擊時鐘。
- 放開蓄力透過 `ATTACK_RELEASE`；`startTick` 用來避免較晚收到放開訊息而把輕斬誤認成蓄斬。
- 完美招架凍結雙端各自8 tick。`step()` 凍結時暫停角色／碰撞／`world.tick`，繼續收集輸入上升緣與處理表現。網路 callback 仍可到達；**沒有完整 rollback、歷史世界重播或延遲保證**。目前 AI 的 `input()` 在 `frame()` 中、`step()` 前呼叫，因此 AI 觀察時鐘仍會在 hitstop 的固定步進期間前進；是需獨立決策的技術債。
- `FINISHER_REQUEST` 由被處決者再次驗證脆弱與距離（160／120容許），只有其端 `takeNode()`；確認回覆才改另一端顯示與結局。
- `attacks / remoteAttacks / results / controls` 去重與容量上限避免重送多扣血。這是互信 P2P，一個惡意防守端仍可謊報；不要宣稱具伺服器權威的競技防作弊。
- HUD 序號缺口是可靠通道訊息缺口估計，**不是 UDP 丟包率**。既有 `sendInput / sendSnapshot` API 未被現在 `Game.frame()` 當作主同步路徑。

## PLANNED：逐步抽出純裁決，不重寫玩法

當第二個內容需求真的需要修飾傷害時，先把 `Game.hit()` 的數值結果抽成 `resolveContact(context) -> CombatResult`；保留上面的防禦順序與 `owns()` 邊界。建議結果只包含 `damage / postureDelta / reaction / effects / attackCancelled / events`，由擁有者一次套用；渲染與音效讀結果，不能再次扣血。

未來資料流程：`AttackSpec → TargetQuery → DefenseResult → ModifierPipeline → StatusApplications → VitalsChange → DefeatRule → DomainEvent`。先只實作所需的修飾器；新增元素或裝備時才補 `damageType / tags / modifiers`。修飾順序須固定並有公式測試，例如基礎值→攻擊者加成→暴擊（若需要）→防禦抗性→防禦結果→夾限；不能讓 UI 或 Boss AI 各算一次。

狀態效果的提案生命週期：`apply → tick → refresh/stack → expire → remove`。最小實例 `{id, sourceId, remainingTicks, stacks, nextTickAt}`，定義表負責 `durationTicks / maxStacks / refreshPolicy / tickInterval / modifiers`。先用現有 burn 做一次等價抽取；凍結期間不扣狀態時間，復燃清除策略要明列。不要把控制 FSM 與可同時存在的 Buff 混成一個巨型狀態枚舉。

**OPTIONAL**：物理／魔法、暴擊、護甲、抗性、HOT、AOE、裝備互動都待玩法確認。若添加多人／多敵人，先完成 [ENEMY_SYSTEM.md](ENEMY_SYSTEM.md) 的 target 與 authority 遷移，不能把 `1 - player.id` 搬到新系統。

## 修改後必測

以 [TESTING.md](TESTING.md) 的命令與 [REGRESSION_CHECKLIST.md](REGRESSION_CHECKLIST.md) 為準。針對本系統需驗證：起手不可轉防禦；12→4 tick招架；HP 49／50／75 邊界；倒地不滑動且4秒後恢復；兩次斷決分別復燃／結束；飲藥第53/54tick及中斷；波次只命中一次；霸體仍能崩解；100/200ms模擬兩端權限、重送與舊回合；60/144/240Hz下同樣邏輯步數。視覺／音效測試不能代替數值與權限測試。
