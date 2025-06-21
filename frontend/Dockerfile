# Use an official Node.js image
FROM node:18-alpine AS development

# Create app directory
WORKDIR /app

# Copy package.json & package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Expose port 8888 (matching docker-compose)
EXPOSE 8888

# The command is specified in docker-compose.yml
CMD ["npm", "run", "dev"]

