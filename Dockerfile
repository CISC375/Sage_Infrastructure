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

RUN npm ci --omit=dev  # Production dependencies only

################################################################################
# Stage 2: Install dev dependencies and run tests
FROM deps as test

# Copy everything, including source files, to run tests
COPY . .

# Install devDependencies (for Jest)
RUN npm ci

# Run tests
RUN npm run test # This will run your Jest tests

# If tests fail, stop the build process
RUN if [ $? -ne 0 ]; then exit 1; fi

################################################################################
# Stage 3: Build the application
FROM test as build

# Copy everything
COPY . .

# Install devDependencies and build the project
RUN npm ci
RUN npm run build

################################################################################
# Stage 4: Runtime image
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

FROM node:latest

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install

COPY . .

CMD ["node", "dist/src/sage.js"]

EXPOSE 8000
