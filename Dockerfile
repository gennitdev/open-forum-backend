# Use a lightweight Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire project
COPY . .

# Set environment variables via Docker secrets (fallback to defaults)
ENV ENVIRONMENT development
ENV NEO4J_URI bolt://localhost:7687
ENV NEO4J_USERNAME neo4j
ENV NEO4J_PASSWORD myfearsthey
ENV SERVER_CONFIG_NAME "Listical"
ENV GCS_BUCKET_NAME listical-dev
ENV GOOGLE_APPLICATION_CREDENTIALS /app/config/listical-dev-gcp.json
ENV GOOGLE_CREDENTIALS_BASE64 ""
ENV SLACK_WEBHOOK_URL ""
ENV AUTH0_DOMAIN ""
ENV AUTH0_CLIENT_ID ""
ENV CYPRESS_ADMIN_TEST_EMAIL ""
ENV CYPRESS_ADMIN_TEST_USERNAME ""

# Build the application
RUN npm run build

# Expose the backend port
EXPOSE 4000

# Start the application
CMD ["npm", "run", "start"]
