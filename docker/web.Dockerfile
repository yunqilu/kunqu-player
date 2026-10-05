FROM node:22.12.0-bookworm-slim

WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci
