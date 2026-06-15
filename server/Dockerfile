FROM node:20-alpine

# Install minimal dependencies for Puppeteer/Chromium
# No LibreOffice required - using pure Node.js solution (Mammoth + Puppeteer)
RUN apk add --no-cache \
    chromium \
    ca-certificates

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Set Puppeteer to use system Chromium instead of downloading
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV PORT=5003
EXPOSE 5003

CMD ["npm","start"]

