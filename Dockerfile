FROM node:20-alpine AS base

# pnpmのインストール
RUN npm install -g pnpm

# 依存関係のインストール
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ビルド
FROM base AS builder
WORKDIR /app

# Firebase環境変数を設定
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

# Algolia環境変数を設定
ARG NEXT_PUBLIC_ALGOLIA_APP_ID
ARG NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY
ARG ALGOLIA_ADMIN_API_KEY
ARG ALGOLIA_INDEX_NAME
ARG NEXT_PUBLIC_ALGOLIA_INDEX_NAME

# 環境変数をNext.jsに渡す
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
ENV NEXT_PUBLIC_ALGOLIA_APP_ID=${NEXT_PUBLIC_ALGOLIA_APP_ID}
ENV NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=${NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY}
ENV ALGOLIA_ADMIN_API_KEY=${ALGOLIA_ADMIN_API_KEY}
ENV NEXT_PUBLIC_ALGOLIA_INDEX_NAME=${NEXT_PUBLIC_ALGOLIA_INDEX_NAME:-$ALGOLIA_INDEX_NAME}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

# 実行
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080

# 実行時に必要な環境変数を設定
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
ENV NEXT_PUBLIC_ALGOLIA_APP_ID=${NEXT_PUBLIC_ALGOLIA_APP_ID}
ENV NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=${NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY}
ENV ALGOLIA_ADMIN_API_KEY=${ALGOLIA_ADMIN_API_KEY}
ENV NEXT_PUBLIC_ALGOLIA_INDEX_NAME=${NEXT_PUBLIC_ALGOLIA_INDEX_NAME:-$ALGOLIA_INDEX_NAME}

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 8080
CMD ["node", "server.js"]
