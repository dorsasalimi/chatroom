# --- deps ---
    FROM node:20-alpine AS deps
    WORKDIR /app
    COPY package.json package-lock.json* ./
    RUN npm ci
    
    # --- runner ---
    FROM node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3000
    # فقط فایل‌های لازم برای اجرا
    COPY --from=build /app ./
    EXPOSE 3000
    CMD ["npm", "run", "start"]
    