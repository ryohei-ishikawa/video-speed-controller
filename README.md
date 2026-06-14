# Video Speed Controller

Netflix・TVer・YouTube など主要動画サイトの再生速度を自由に調整できる Chrome 拡張機能 (Manifest V3)。

## 主な機能

- 画面右上の浮遊ウィジェットで速度表示・調整（ドラッグで移動可能）
- ポップアップ UI（プリセット 0.5x〜4x、数値入力、リセット、表示切替）
- サイト（hostname）ごとに速度を保存
- iframe 内動画にも `postMessage` で速度を伝播（TVer 等のプレーヤーに対応）
- Shadow DOM 内の `<video>` も `MutationObserver` で再帰検索
- フルスクリーン時もウィジェットを再アタッチして表示
- 0.07x〜16x の広い速度幅

## キーボードショートカット

| キー | 動作 |
| --- | --- |
| `S` | 速度を 0.1x 遅く |
| `D` | 速度を 0.1x 速く |
| `R` | 1.0x にリセット |
| `Z` | 10 秒戻る |
| `X` | 10 秒進む |
| `V` | ウィジェット表示切替 |

## インストール

1. このリポジトリを clone またはダウンロード
2. Chrome で `chrome://extensions/` を開く
3. 右上の「**デベロッパー モード**」を ON
4. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
5. このリポジトリのルートディレクトリを選択

## ファイル構成

```
.
├── manifest.json        # MV3 定義
├── content.js           # 動画検出・速度適用・ウィジェット・iframe 同期
├── content.css          # ウィジェットスタイル
├── popup.html           # ポップアップ UI
├── popup.css
├── popup.js
└── icons/               # 16 / 48 / 128 px アイコン
```

## ライセンス

MIT
