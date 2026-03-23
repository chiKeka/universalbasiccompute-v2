FROM node:22-slim

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tools/package.json tools/
COPY runtime/package.json runtime/
COPY packages/shared/package.json packages/shared/
COPY apps/cli/package.json apps/cli/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @ubcv2/shared build

EXPOSE 3000

# Default: start the master agent
CMD ["pnpm", "--filter", "@ubcv2/runtime", "exec", "tsx", "src/index.ts", "start"]
