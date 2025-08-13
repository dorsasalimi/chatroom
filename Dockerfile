FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package*.json ./
# چون tsx در dependencies است، نصب می‌شود
RUN npm ci --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

# اگر ورودی‌ات مثلاً src/index.ts است اصلاح کن
CMD ["npx", "tsx", "src/index.ts"]
