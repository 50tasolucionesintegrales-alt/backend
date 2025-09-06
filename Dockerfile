# Usa Node 18
FROM node:18

# Carpeta de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala dependencias incluyendo Nest CLI
RUN npm install --production
RUN npm install -g @nestjs/cli

# Copia todo el código
COPY . .

# Expone puerto
EXPOSE 3000

# Comando para iniciar
CMD ["nest", "start"]