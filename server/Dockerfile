FROM node:22-slim

WORKDIR /app

# Single-file server. No dependencies to install.
COPY index.mjs ./index.mjs
COPY README.md ./README.md

# The server writes keys and telemetry here on first boot. Mount a volume in
# production so they persist. The node user must own the directory to write it.
RUN mkdir -p ./.keys && chown -R node:node /app

EXPOSE 3000

USER node
CMD ["node", "index.mjs", "--port", "3000"]
