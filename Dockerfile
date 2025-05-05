# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=20.18.3

################################################################################
# Use node image for base image for all stages.

FROM node:${NODE_VERSION}-alpine as base


# Set working directory for all build stages.
WORKDIR /usr/src/app



################################################################################
# Create a stage for installing production dependecies.
FROM base as deps



# Install Python and required build tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pixman-dev \
    cairo-dev \
    pango-dev \
    giflib-dev \
    jpeg-dev

# Download dependencies as a separate step to take advantage of Docker's caching.
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
# Create a stage for building the application.

FROM deps as build


# Download additional development dependencies before building, as some projects require
# "devDependencies" to be installed to build. If you don't need this, remove this step.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the rest of the source files into the image.
COPY . .
# Run the build script.
RUN npm run build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.

FROM base as final

# Use production node environment by default.
ENV NODE_ENV production


# Install runtime shared libraries needed by canvas
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib


# Run the application as a non-root user.
USER node

# Copy package.json so that package manager commands can be used.
COPY package.json .

COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/package-lock.json ./package-lock.json

COPY --from=build /usr/src/app/tsconfig.json ./tsconfig.json

# Copy the production dependencies from the deps stage and also
# the built application from the build stage into the image.

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/assets ./assets


# Expose the port that the application listens on.
EXPOSE 8080

# Run the application.
CMD ["node", "dist/src/sage.js"]

