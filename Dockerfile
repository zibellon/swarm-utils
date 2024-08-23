#########
# BUILD
#########
FROM --platform=linux/amd64 docker:25.0.5-cli-alpine3.20 AS build

WORKDIR /app

RUN apk add bash nodejs=20.15.1-r0 npm=10.8.0-r0 yarn=1.22.22-r0

COPY package.json ./
COPY yarn.lock ./

# Установка зависимостей
RUN yarn install --frozen-lockfile

# Копируем исходники
COPY tsconfig.json ./
COPY esbuild.config.js ./
COPY src ./src

# Сборка
RUN yarn tsc --noEmit && node esbuild.config.js

#########
# DEPLOY
#########
FROM --platform=linux/amd64 docker:25.0.5-cli-alpine3.20 AS deploy

WORKDIR /app

RUN apk add bash nodejs=20.15.1-r0 npm=10.8.0-r0 yarn=1.22.22-r0

COPY --from=build ./app/dist ./dist

#Команда для запуска сервера внутри контейнера
CMD ["/bin/bash", "-c", "node ./dist/index.js"]