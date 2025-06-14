# Use official Node.js image
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package.json & package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# If you use environment variables, copy .env
# (Optional) Uncomment if you have a .env in backend
COPY .development.env .development.env

# Expose whichever port your app listens on, e.g., 3000
EXPOSE 3000

# Default command to run your Node.js server
CMD ["npm", "start"]
