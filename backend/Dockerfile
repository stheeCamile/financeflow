FROM node:20-alpine

# Instalar dependências necessárias para possíveis libs nativas do whatsapp
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
