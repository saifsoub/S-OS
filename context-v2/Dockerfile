FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY tests ./tests
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV PORT=8787 S_CONTEXT_DB=/data/context-v2.sqlite
EXPOSE 8787
CMD ["node", "src/server.js"]
