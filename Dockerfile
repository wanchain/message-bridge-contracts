FROM node:18

# Set the work directory
WORKDIR /app

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install hardhat
RUN yarn

# Copy the rest of the application
COPY . .

# Expose the hardhat port
EXPOSE 8545

