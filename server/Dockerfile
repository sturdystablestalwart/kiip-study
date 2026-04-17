FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create uploads directories
RUN mkdir -p uploads/images uploads/documents

# Drop to non-root user for security
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "index.js"]
