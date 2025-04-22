# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.18.3

FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app

################################################################################
# Stage 1: Install production dependencies
FROM base as deps

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pixman-dev \
    cairo-dev \
    pango-dev \
    giflib-dev \
    jpeg-dev

COPY package.json package-lock.json install-deps.js ./

RUN printf '%s\n' '{' \
    '  "targets": [' \
    '    {' \
    '      "target_name": "sage",' \
    '      "sources": ["src/sage.ts"]' \
    '    }' \
    '  ]' \
    '}' > binding.gyp

RUN npm ci --omit=dev

################################################################################
# Stage 2: Build the application
FROM deps as build

# Copy everything (including source files)
COPY . .

# Install devDependencies and build the project
RUN npm ci
RUN npm run build

################################################################################
# Stage 3: Runtime image
FROM base as final

ENV NODE_ENV=production

RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib

USER node

WORKDIR /usr/src/app

COPY package.json .
COPY --from=build /usr/src/app/package-lock.json ./package-lock.json
COPY --from=build /usr/src/app/tsconfig.json ./tsconfig.json

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/assets ./assets

FROM node:20

WORKDIR /usr/src/app

COPY package.json ./

COPY . .

RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev

RUN npm install




EXPOSE 8000

CMD ["node", "dist/src/sage.js"]
