# syntax=docker/dockerfile:1

# Define the Node version
ARG NODE_VERSION=20.18.3

# ─────────────────────────────────────────────────────────────
# Base image with Node and build tools
FROM node:${NODE_VERSION}-alpine AS base

# Set working directory
WORKDIR /usr/src/app

# Install system dependencies for building native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pixman-dev \
    cairo-dev \
    pango-dev \
    giflib-dev \
    jpeg-dev

# ─────────────────────────────────────────────────────────────
# Dependencies stage (production)
FROM base AS deps

# Copy package files and install-deps.js first for better caching
COPY package.json package-lock.json install-deps.js ./

# Create binding.gyp file required by some native modules
RUN printf '{\n  "targets": [\n    {\n      "target_name": "sage",\n      "sources": ["src/sage.ts"]\n    }\n  ]\n}\n' > binding.gyp

# Install production dependencies
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────
# Build stage (development + build)
FROM deps AS build

# Mount caching for npm to speed up subsequent installs
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the rest of the source code into the container
COPY . .

# Build the project
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Final runtime stage (minimal image)
FROM base AS final

ENV NODE_ENV=production

# Install only runtime libraries needed by canvas
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib

# Run the application as a non-root user
USER node

# Copy package.json so package manager commands work
COPY package.json . 

# Copy necessary files from previous stages
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/package-lock.json ./package-lock.json
COPY --from=build /usr/src/app/tsconfig.json ./tsconfig.json
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/assets ./assets

# Expose the application port
EXPOSE 8080

# Run the application
CMD ["node", "dist/src/sage.js"]