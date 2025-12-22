# BunProxyGUI

複数のBunProxyインスタンスをブラウザから簡単に管理できるWebベースのGUIツールです。

## ✨ 主な機能

- **複数インスタンス管理** - 複数のBunProxyを同時に管理・運用
- **自動ダウンロード** - GitHubから最新バイナリを自動取得
- **リアルタイムログ** - WebSocketでコンソール出力を即座に表示
- **設定エディタ** - config.ymlをGUIで編集可能
- **認証機能** - パスワード保護でセキュアに管理
- **多言語対応** - 日本語・英語に対応
- **ダーク/ライトモード** - テーマ切り替え対応

## 必要な環境

- Bun 1.0以降（推奨）または Node.js 18以降
- 対応OS: Linux / macOS / Windows

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/gamelist1990/BunProxyGUI.git
cd BunProxyGUI

# 依存関係をインストール
bun install
cd frontend && bun install && cd ..

# フロントエンドをビルド
bun run build:frontend
```

## 起動方法

### 開発モード

```bash
bun run alldev
```

`http://localhost:3000` にアクセスしてください。

### 本番モード

```bash
bun run build
bun run start
```

### スタンドアロン実行ファイルの作成

```bash
# 現在のプラットフォーム用
bun run build:compile

# すべてのプラットフォーム用
bun run build:all
```

生成されたバイナリを実行するだけで、Node.js/Bunのインストール不要で動作します。

## 使い方

### 初回セットアップ

1. ブラウザで `http://localhost:3000` を開く
2. 初回アクセス時に認証設定を促されます（任意のユーザー名とパスワードを設定）

### インスタンスの作成

1. サイドバーの「新規インスタンス作成」セクションに入力
   - インスタンス名を入力
   - プラットフォームを選択（Linux/macOS/Windows）
   - バージョンを選択（latest または特定バージョン）
2. 「インスタンス作成」をクリック
3. 自動的にバイナリがダウンロードされ、初期化されます

### インスタンスの操作

- **起動** - 停止中のインスタンスを起動
- **停止** - 実行中のインスタンスを停止
- **再起動** - インスタンスを再起動
- **削除** - インスタンスを完全に削除

### ログの確認

インスタンスを選択すると、リアルタイムでログが表示されます。標準出力・標準エラー・システムメッセージを色分けして表示します。

### 設定の編集

1. インスタンスを選択
2. 「設定」セクションでconfig.ymlの内容を編集
3. 「設定を保存」をクリック
4. インスタンスを再起動して反映

## ディレクトリ構成

```
BunProxyGUI/
├── src/                    # バックエンド（Bun/Node.js）
│   ├── index.ts           # メインサーバー
│   ├── processManager.ts  # プロセス管理
│   ├── configManager.ts   # 設定管理
│   ├── downloader.ts      # ダウンロード処理
│   └── services.ts        # データ管理
│
├── frontend/              # フロントエンド（React + Vite）
│   └── src/
│       ├── App.tsx       # メインコンポーネント
│       ├── components/   # UIコンポーネント
│       ├── lang/         # 多言語対応
│       └── utils/        # ユーティリティ
│
├── instances/            # インスタンスデータ
│   └── [instance-id]/
│       ├── data/        # バイナリ
│       └── config.yml   # 設定ファイル
│
├── public/              # ビルド済みフロントエンド
└── services.json        # インスタンスメタデータ
```

## トラブルシューティング

### ポートが使用中

```bash
PORT=4000 bun run start
```

環境変数でポートを変更できます。

### GitHub APIレート制限

無料アカウントでは1時間あたり60リクエストの制限があります。レート制限に達した場合、デフォルトバージョン(BunProxy)が使用されます。

### WebSocket接続エラー

ファイアウォールでポート3000を許可してください。

## 開発に参加する

プルリクエストを歓迎します！バグ報告や機能提案もIssueでお待ちしています。

## ライセンス

MIT License

---

**関連リンク**
- [BunProxy本体](https://github.com/gamelist1990/BunProxy)
- [BunProxyリリース](https://github.com/gamelist1990/BunProxy/releases)


