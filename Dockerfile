# --- deps ---
    FROM node:20-alpine AS deps
    WORKDIR /app
    COPY package.json package-lock.json* ./
    RUN npm ci
    
    # --- build ---
    FROM node:20-alpine AS build
    WORKDIR /app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    # اگر Next 13+ هستی، همین کافیست
    RUN npm run build
    
    # --- runner ---
    FROM node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3000
    # فقط فایل‌های لازم برای اجرا
    COPY --from=build /app ./
    EXPOSE 3000
    CMD ["npm", "run", "start"]
    