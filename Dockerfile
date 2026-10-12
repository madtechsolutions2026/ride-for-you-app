FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY admin/package*.json ./admin/
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
RUN cd admin && npm ci
RUN cd backend && npm ci
COPY admin ./admin
COPY backend ./backend
RUN cd admin && npm run build
RUN cd backend && npx prisma generate && npx tsc

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
RUN cd backend && npm ci --omit=dev
COPY --from=builder /app/admin/dist ./admin/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=builder /app/backend/node_modules/@prisma ./backend/node_modules/@prisma
WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && node dist/app.js"]
