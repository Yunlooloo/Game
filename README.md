# 斬境殘響 · Riftblade Echoes

原創 2D 刀劍對決原型：以削血、架勢、招架和反制爭取斷決機會。純 JavaScript、HTML5 Canvas 與 Web Audio；發行品仍是一個可直接開啟的 `index.html`。

[開始遊戲](https://yunlooloo.github.io/Game/) · [目前狀態](docs/PROJECT_STATUS.md) · [文件入口](docs/README.md) · [AI 接手導航](docs/AI_HANDOFF.md)

## 現況 · IMPLEMENTED

- 一名 Boss「赤衡」、三核心／三階段試煉，玩家雙核心復燃、多層戰場與天候。
- 連續成功招架不縮窗、可讀連段與反擊空檔；五種共鳴裝備、兩種奧義，以及 22 課互動陪練。
- 單人 AI、同屏雙人、PeerJS WebRTC 雙人模式。
- 蓄刺與雙斷各有用途；空中蹬踏支援短暫緩衝與近距離踏入輔助。
- 手機左側上跳下移、右側攻防，技具可收合；鍵盤／滑鼠／觸控共用戰鬥規則。
- 程序化 Canvas 人物與場景、合成音效、內嵌背景音樂。
- 內部戰鬥固定 60 Hz；手機音訊需要使用者手勢啟動。

目前 **沒有**戰役、多 Boss 選單、背包、任務或完整存檔。這些是 [PLANNED 藍圖](docs/ARCHITECTURE.md)，不是現有 API。公開網路連線與 iPhone 實機驗證仍有 [已知限制](docs/TECH_DEBT.md)。

## 啟動、建置與檢查

遊玩不需安裝套件。開發需要 Python 3.11+；靜態檢查與單元測試另需 Node.js 22+。

```sh
git clone https://github.com/Yunlooloo/Game.git
cd Game
python3 -m http.server 8000 --bind 127.0.0.1
```

一般本機瀏覽器開啟 `http://127.0.0.1:8000`。雲端工作區依平台的預覽／連接方式操作；不要將 loopback 位址當作公開邀請網址。

```sh
python3 scripts/build.py          # src + vendor + music → index.html
python3 scripts/build.py --check  # 驗證已提交產物沒有過期
python3 scripts/check.py          # 建置一致性、語法與文件檢查
python3 scripts/test.py           # 不需要瀏覽器的回歸測試
```

瀏覽器安裝、煙霧測試與驗證範圍見 [TESTING](docs/TESTING.md)。不要直接修改產出的 `index.html`；請修改 `src/` 後重建。

## 專案結構

```text
src/          原始 JS 模組、HTML 外殼、教學 UI
vendor/       內嵌 PeerJS 發行檔
assets/       音樂原檔
scripts/      可重現建置與檢查入口
tests/        核心回歸與瀏覽器驗證
docs/         現況、擴充設計、維運與 AI 交接
index.html    GitHub Pages 的單檔發行產物
```

檔案責任與關鍵函式：[PROJECT_MAP](docs/PROJECT_MAP.md)。新 AI 先讀 [AGENTS.md](AGENTS.md)，再由 [AI_HANDOFF](docs/AI_HANDOFF.md) 找到要修改的系統。新增內容依 [CONTENT_COOKBOOK](docs/CONTENT_COOKBOOK.md)，日常開發依 [DEVELOPMENT](docs/DEVELOPMENT.md)。

## 部署

目前 GitHub Pages 直接發布 `main` 的根目錄。必須先重建並提交 `index.html`；CI 是品質檢查，不是部署授權閘門。發布、驗證與 rollback 的唯一操作指南是 [DEPLOYMENT](docs/DEPLOYMENT.md)。

## 授權

本專案尚未指定整體開源授權，不應推定可任意再授權或商用所有內容。PeerJS 的 MIT 授權及音樂來源／待確認權利見 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。原創命名與程序美術不等同於法律意見或零風險保證。
