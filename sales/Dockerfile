FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=:: PORT=3050 DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs auth.mjs inventory-import.mjs invoice-pdf.mjs gst-invoices.mjs gst-pdf.mjs components.mjs service.mjs ./
COPY public ./public
COPY assets ./assets
RUN mkdir -p /data && chown node:node /data
EXPOSE 3050
HEALTHCHECK --interval=20s --timeout=5s --retries=5 CMD ["node","-e","fetch('http://127.0.0.1:'+(process.env.PORT||3050)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node","server.mjs"]
