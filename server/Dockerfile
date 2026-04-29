FROM node:22-slim

WORKDIR /app

# Single-file server. No dependencies to install.
COPY index.mjs ./index.mjs
COPY README.md ./README.md

# The server creates these on first boot if missing; a volume mount is
# recommended for production so keys and telemetry persist.
RUN mkdir -p ./.keys

EXPOSE 3000

USER node
CMD ["node", "index.mjs", "--port", "3000"]
