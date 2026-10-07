# 回歸檢查表

**IMPLEMENTED**：此表用於既有 v4.2.0 功能的交付檢查。空 checkbox 是待執行，不代表失敗，也不是先前通過紀錄；本次證據另見 [VALIDATION](VALIDATION.md)。**PLANNED** 系統有專屬段落，加入前不需假装已有測試。命令與測試範圍以 [TESTING](TESTING.md) 為真實來源。

## 每次交付

- [ ] 已讀對應 system、既有 pattern、known issues，限定修改範圍。
- [ ] Build、`scripts/check.py`、Node suites 通過；source 與根目錄 `index.html` 一致。
- [ ] UI／audio／input／核心流程或 build 變更後，Chromium smoke 通過。
- [ ] HTTP 啟動可見主選單與 Canvas；沒有 JavaScript exception。
- [ ] 玩家能移動、跳躍、輕斬、防禦；Boss 可被打倒、三次斷決後結束、能重開。
- [ ] 維護文件／manifest／CHANGELOG 符合實際版本，沒有把未實作功能寫為已存在。
- [ ] `git diff --check` 通過；無 credential、`.env`、cache、test-results 或外部路徑混入提交。

## 戰鬥與 Boss

- [ ] 60 Hz 固定戰鬥步長在不同 render cadence 維持相同速度；hitstop 不吞攻防輸入。
- [ ] HP比例 ≥75%／50–75%／<50% 的架勢恢復分段正確；<50 時為零，防禦倍率不能恢復零基數。
- [ ] 點按防禦有招架，長按為格擋，抖刀窗口縮小；STARTUP／硬直不能任意 guard cancel。
- [ ] 突刺踏刃、橫掃蹬踏、接電落地／雷返、投射物與多波 move 去重正常。
- [ ] 五種裝備、兩種奧義的成本、衍生／combo、恢復與反制維持原規則。
- [ ] HP 歸零或架勢破裂進入倒地，不自動逃走；逾時恢復到低血可戰状態。
- [ ] 第一核心消耗後 HP／架勢重置，第二階段啟動；玩家/PvP第二核心、赤衡第三核心耗盡才結束對局。
- [ ] 飲藥 54 tick 才治療，被擊中取消、沒有退款或重複治療；Boss 可選擇安全飲藥。
- [ ] 玩家在 Boss 上方／下方／不同平台，Boss 能接近或選路，不持續卡在同一點。
- [ ] AI 保留 200 ms 視覺反應與視野限制，未讀取玩家 keyboard event；第二階段才用指定新招。
- [ ] 開啟、切課、重試、完成與離開 22 課陪練，訓練補給／勝利鎖不洩漏正式對局。

## 輸入與畫面

- [ ] 左滑鼠斬、右滑鼠架、键盤替代輸入和同屏雙人正常；視窗失焦不留卡鍵。
- [ ] Portrait／landscape 下左右移動、斬／架是大目標，輔助鍵不重疊或出界。
- [ ] 長按移動不選取網頁、捲動或打開 callout；兩指移動＋攻防可同時作用。
- [ ] pointer cancel／lost capture／lobby 切換清掉 held 狀態；短 tap 不因釋放遺失 attack edge。
- [ ] 房號仍可輸入與選取，lobby／教學可捲動；防選取沒有套到整頁。
- [ ] 暫停／恢復可由手機操作；教學收合後角色可見，仍可重新展開說明。
- [ ] 常見寬高比與高 DPI 首次進入正常；旋轉／resize 的現有風險有記錄，未修正時不宣稱支援完成。

## 音訊與實機

- [ ] 第一個可信手勢能開啟聲音；「開啟聲音」不會立即反轉成 mute。
- [ ] 主選單 ambient／戰鬥 battle 播放並切換；音樂不蓋過彈反，危險招有提示音。
- [ ] 有效／載入中BGM不疊合成風雨河流；音樂音量零不啟動fallback，音樂缺失／報錯仍可合成氛圍。
- [ ] 主音量、音樂音量、mute、pause／resume、返回 lobby 不產生重複音軌。
- [ ] `interrupted` context 與尚未 resolve 的舊 resume，不阻止下一次手勢重試。
- [ ] 真實 iPhone Safari／Chrome：觸控啟動、切背景再回來、靜音設定／音量／音訊路由逐項驗證並記錄裝置版本。
- [ ] 實際喇叭／耳機音效可聽；只用 headless waveform 時明確標示未驗證硬體。

## 連線

- [ ] 防守方裁決、attack/contact ID 去重、重送／過期／錯誤封包不重複扣血。
- [ ] Remote pose 不覆蓋本機 HP／架勢；終擊、復燃、rematch 與斷線清理維持一致。
- [ ] 模擬 100／200 ms latency suites 通過；沒有將它們當作跨網路驗證。
- [ ] 若修改 network：兩台裝置、不同網路實測房號、邀請連結、RTT、DataChannel、重連／退出；NAT／relay 限制如實記錄。

## 發布

- [ ] 用正確 branch 與已授權流程 commit／push；CI 結果與 Pages build 分開確認。
- [ ] Pages 回報最新 commit 且成功，公開 URL HTTP 200；內容 hash 與本地產物相同。
- [ ] 公開網址重載可啟動，若是緊急修正提供 cache-busting URL；不要只看 build badge。
- [ ] 所有未測項與已知問題在交付中列明，必要時保留前一 commit 的回退方法。

## 新系統加入時（PLANNED）

- [ ] Inventory：堆疊上限、滿格、消耗原子性、掉落／獎勵一次性與無效 ID。
- [ ] Stats／equipment：modifier 順序、裝卸可逆、暫時 buff 到期不污染 base stats。
- [ ] Save：`saveVersion`、舊版 fixture migration、損壞／未來版本、安全寫入與 storage quota。
- [ ] Stage／story：條件、transition rollback、checkpoint、對話中止與一次性事件不重複。
- [ ] 新 Boss：共享戰鬥契約和原 Boss 全部維持，phase／能力／reward／arena 定義可單獨驗證。

## 接刀節奏（4.1.0引入，維持於4.2.0）· IMPLEMENTED

- [ ] 赤衡三核240HP／220架勢，前兩次斷決復燃，第三次結束；玩家與PvP仍雙核100。
- [ ] 三連斬、裂斬逐拍完美招架；成功重置窗口，按住只普通格擋。
- [ ] 快速空按最低12tick；受擊硬直結束不出現無防備的一幀。
- [ ] 輕招收招6tick後轉防禦；起手、有效段、飲藥不可取消。
- [ ] 裂斬普通格擋無HP穿透；波間收刀無隱形判定，突進不穿過對手。
- [ ] 蓄刺提示對準真正出刀，Boss連段結束可反擊，各階段不加速起手。
- [ ] 協議5拒絕舊協議4；所有教學仍可完成。

## 4.2.0 蹬踏與手機操作 · IMPLEMENTED

- [ ] 左側上方跳躍＋下方左右移動，右側墊步＋架／斬；技具預設收合、展開五項能力仍可使用。
- [ ] HUD選單可暫停／恢復本機；線上只開手冊，不停止對局。
- [ ] 空中再次跳躍，在170px內輔助蹬踏；12tick緩衝與收招18tick寬限成立。
- [ ] 隔平台、過遠、非橫掃與起手／飲藥鎖不蹬踏；同attackId不能重複反制。
- [ ] 長按斬僅一發蓄刺，可擋可架無危字；Boss紅突不可普通格擋，雙斷仍有兩擊與架勢回復。
