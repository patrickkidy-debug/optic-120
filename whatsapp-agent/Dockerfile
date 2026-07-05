FROM node:22-bookworm-slim

WORKDIR /app

# Dépendances (les scripts d'install de Baileys/protobuf s'exécutent ici)
COPY package.json ./
RUN npm install --omit=dev

# Code de l'agent
COPY . .

ENV NODE_ENV=production
# Dossier de session persistant (à monter sur un volume, ex. /data)
ENV AUTH_DIR=/data/auth

# Port de la page web de scan (Railway/host injecte PORT)
EXPOSE 3000

CMD ["node", "index.js"]
