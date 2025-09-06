# Imagen base con Node 18 completo
FROM node:18

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar todo el proyecto
COPY . .

# Exponer puerto 3000
EXPOSE 3000

# Comando de inicio
CMD ["npm", "run", "start"]