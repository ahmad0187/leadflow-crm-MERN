# Builds the React client, then runs the API, which also serves the built client.
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./server/
RUN npm --prefix server ci --omit=dev && npm cache clean --force
COPY server/src ./server/src
COPY --from=client /app/client/dist ./client/dist
USER node
EXPOSE 4000
CMD ["node", "server/src/index.js"]
