FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/uploads
ENV NODE_ENV=production
ENV PORT=5002
EXPOSE 5002
CMD ["npm", "start"]
