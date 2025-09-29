# Usa Node 18
FROM node:20

# Carpeta de trabajo
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala todas las dependencias para build (incluyendo dev)
RUN npm install

# Copia todo el código
COPY . .

# Compila TypeScript a JavaScript
RUN npm run build

# Expone puerto
EXPOSE 3000

# Comando para iniciar la app compilada
CMD ["node", "dist/main.js"]
