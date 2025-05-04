# Dockerfile for Next.js App on Cloud Run

# 1. Base Image (Node.js)
FROM node:20-alpine AS base

# pnpmのインストール
RUN npm install -g pnpm

# 2. Dependencies Stage
FROM base AS deps
WORKDIR /app

# package.json と pnpm-lock.yaml をコピー
COPY package.json pnpm-lock.yaml ./

# 依存関係のインストール (開発 + 本番)
RUN pnpm install --frozen-lockfile

# 3. Build Stage
FROM base AS builder
WORKDIR /app

# deps ステージから node_modules をコピー
COPY --from=deps /app/node_modules ./node_modules
# ソースコード全体をコピー
COPY . .

# .env.local がビルド時に存在しないようにする (必要な変数はビルド引数やCloud Buildで渡す)
# COPY .env.local ./.env.local

# Next.js をビルド（standalone 出力）
RUN pnpm run build

# 4. Runner Stage (Final Image)
FROM base AS runner
WORKDIR /app

# 環境設定 & ポート番号 (Cloud Run はデフォルトで 8080)
ENV NODE_ENV=production \
    PORT=8080 \
    NEXT_TELEMETRY_DISABLED=1

# 必要なユーザー/グループを作成 (セキュリティ強化)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# builder ステージからビルド成果物 (standalone) をコピー
COPY --from=builder /app/public ./public
# Next.js v12+ の Standalone Output を利用
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# ユーザーを切り替え
USER nextjs

# 公開するポート
EXPOSE 8080

# アプリケーションの起動コマンド
CMD ["node", "server.js"] 