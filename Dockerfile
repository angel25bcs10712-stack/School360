FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend

ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "backend/src/server.js"]
