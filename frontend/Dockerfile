FROM node:20-slim

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

EXPOSE 3000

# Run in dev mode with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
