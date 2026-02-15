FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create uploads directories
RUN mkdir -p uploads/images uploads/documents

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "index.js"]
