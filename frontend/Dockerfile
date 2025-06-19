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
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# -----------------
# Stage 2: Serve statically with a lightweight server
FROM nginx:stable-alpine

# Remove default Nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Default command
CMD ["nginx", "-g", "daemon off;"]
