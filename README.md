# BunProxyGUI

BunProxy の GUI 管理ツール - ブラウザから複数の BunProxy インスタンスを管理できます。

![BunProxyGUI](https://img.shields.io/badge/version-1.0.0-blue)

## 🚀 機能

- 📦 **複数インスタンス管理**: 複数の BunProxy インスタンスを同時に管理
- 🔄 **自動ダウンロード**: GitHub Releases から最新のバイナリを自動取得
- ✅ **SHA256 検証**: ダウンロードしたバイナリの整合性を自動検証
- 🎮 **プロセス管理**: インスタンスの起動、停止、再起動を簡単に操作
- 📝 **リアルタイムログ**: WebSocket 経由でコンソールログをリアルタイム表示
- ⚙️ **ビジュアル設定編集**: config.yml を GUI から編集可能
- 🔔 **更新通知**: 新しいバージョンのチェック（更新はユーザー判断）
- 🌐 **Web UI**: React + Vite で構築されたモダンな UI
- 🌍 **多言語サポート**: 日本語・英語対応（ヘッダーで切り替え可能）
- 🚀 **Bun 対応**: Bun で高速実行・ビルド・スタンドアロンコンパイル

## 📋 必要要件

- **Bun 1.0+** (推奨) または Node.js 18+
- npm または yarn

## 🛠️ インストール

### Bun を使用（推奨）

```bash
# リポジトリをクローン
git clone https://github.com/gamelist1990/BunProxyGUI.git
cd BunProxyGUI

# 依存関係をインストール
bun install

# フロントエンドをビルド
cd frontend
bun install
bun run build
cd ..

# バックエンドをビルド
bun run build
```

### npm を使用

```bash
# リポジトリをクローン
git clone https://github.com/gamelist1990/BunProxyGUI.git
cd BunProxyGUI

# 依存関係をインストール
npm install

# フロントエンドをビルド
cd frontend
npm install
npm run build
cd ..

# バックエンドをビルド
npm run build
```

## 🎯 使い方

### サーバーを起動

#### Bun を使用（推奨）

```bash
# 開発モード（ホットリロード）
bun run dev

# 本番モード
bun run start
```

#### npm を使用

```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

ブラウザで `http://localhost:3000` にアクセスします。

### スタンドアロンバイナリ作成（Bun）

Bun を使用すると、Node.js 不要の単一実行ファイルを作成できます：

```bash
# 現在のプラットフォーム向け
bun run build:compile

# Linux 向け
bun run build:compile:linux

# macOS (ARM64) 向け
bun run build:compile:darwin

# Windows 向け
bun run build:compile:windows

# すべてのプラットフォーム向け
bun run build:all
```

生成されたバイナリを実行：

```bash
# Linux/macOS
./bunproxy-gui-linux
./bunproxy-gui-darwin

# Windows
bunproxy-gui-windows.exe
```

### 言語切り替え

ヘッダー右上のドロップダウンから言語を選択できます：
- 🇯🇵 日本語
- 🇺🇸 English

言語設定はブラウザの localStorage に保存されます。

### インスタンスを作成

1. サイドバーの "Create New Instance" セクションに以下を入力:
   - **Instance name**: わかりやすい名前
   - **Platform**: linux / macOS (ARM64) / Windows
   - **Version**: 例: `0.0.5`

2. "Create Instance" をクリック

3. GUI が自動的に:
   - GitHub Releases からバイナリをダウンロード
   - SHA256 チェックサムを検証
   - 実行権限を設定（Linux/macOS）
   - `instances/<id>/data/` にバイナリを保存

### インスタンスを管理

- **起動**: "Start" ボタン
- **停止**: "Stop" ボタン
- **再起動**: "Restart" ボタン
- **削除**: "Delete" ボタン（確認あり）

### ログを表示

インスタンスを選択すると、リアルタイムでコンソールログが表示されます：
- 🟢 stdout（標準出力）
- 🔴 stderr（エラー出力）
- 🔵 system（システムメッセージ）

### 設定を編集

1. インスタンスを選択
2. "Configuration" セクションで JSON を編集
3. "Save Config" をクリック
4. インスタンスを再起動して変更を適用

### 更新をチェック

ヘッダーの "Check Updates" ボタンをクリックすると、最新バージョンを確認できます。更新が必要な場合は通知されますが、更新は手動で行います。

## 📁 ディレクトリ構造

```
BunProxyGUI/
├── src/                    # バックエンドソース
│   ├── index.ts           # メインサーバー
│   ├── services.ts        # サービス管理
│   ├── processManager.ts  # プロセス管理
│   ├── configManager.ts   # 設定管理
│   └── downloader.ts      # ダウンロード機能
├── frontend/              # React フロントエンド
│   └── src/
│       ├── App.tsx       # メインコンポーネント
│       ├── api.ts        # API クライアント
│       └── useWebSocket.ts
├── public/               # ビルドされたフロントエンド
├── instances/            # インスタンスデータ
│   └── <instance-id>/
│       ├── data/        # バイナリ保存先
│       └── config.yml   # 生成された設定
├── services.json         # インスタンスメタデータ
└── package.json
```

## 🔧 API エンドポイント

### インスタンス管理

- `GET /api/instances` - 全インスタンス取得
- `GET /api/instances/:id` - 特定インスタンス取得
- `POST /api/instances` - 新規インスタンス作成
- `DELETE /api/instances/:id` - インスタンス削除

### プロセス制御

- `POST /api/instances/:id/start` - インスタンス起動
- `POST /api/instances/:id/stop` - インスタンス停止
- `POST /api/instances/:id/restart` - インスタンス再起動

### ログと設定

- `GET /api/instances/:id/logs` - ログ取得
- `GET /api/instances/:id/config` - 設定取得
- `PUT /api/instances/:id/config` - 設定更新

### 更新確認

- `GET /api/updates/check` - 全インスタンスの更新確認
- `GET /api/releases/latest` - 最新リリース情報取得

## 🔐 セキュリティ

- **SHA256 検証**: すべてのダウンロードで自動検証
- **URL 検証**: 公式 GitHub Releases のみ許可
- **実行権限**: Linux/macOS で自動設定
- **プロセス分離**: 各インスタンスは独立したプロセス

## 🐛 トラブルシューティング

### ポート競合

デフォルトポート（3000）が使用中の場合:

```bash
PORT=4000 npm start
```

### WebSocket 接続エラー

ファイアウォールで WebSocket（ポート 3000）を許可してください。

### ダウンロード失敗

- インターネット接続を確認
- GitHub API のレート制限（60 req/hour）を確認
- プロキシ設定を確認

## 📝 ライセンス

MIT

## 👥 コントリビューション

プルリクエストを歓迎します！

## 🔗 関連リンク

- [BunProxy Repository](https://github.com/gamelist1990/BunProxy)
- [BunProxy Releases](https://github.com/gamelist1990/BunProxy/releases)

