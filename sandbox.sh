#!/bin/bash

# Define output colors
GREEN="\033[0;32m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No color

# Welcome message
echo -e "${GREEN}Welcome to Wanchain Message Bridge Sandbox!${NC}"
echo 
# Instructions
echo -e "${BLUE}Please note: This script requires 'docker' and 'docker-compose' to be pre-installed.${NC}"
echo 

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: 'docker' is not installed. Please install it and run the script again.${NC}"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: 'docker-compose' is not installed. Please install it and run the script again.${NC}"
    exit 1
fi

# Sandbox environment details
echo -e "${BLUE}Sandbox Environment Details:${NC}"
echo "2 Docker containers dedicated to independent EVM blockchains."
echo "1 Docker container hosting an agent for cross-chain execution assistance."
echo 
echo -e "${GREEN}Starting dockers please wait...${NC}"

# Starting docker
docker-compose up -d

echo

echo -e "${GREEN}Deploying WmbGateway contracts, please wait...${NC}"

yarn

sleep 5

yarn hardhat --config ./hardhat.chain1.config.js --network chain1 run ./scripts/deploy_sandbox.js

yarn hardhat --config ./hardhat.chain1.config.js --network chain2 run ./scripts/deploy_sandbox.js

echo

echo -e "${GREEN}**********************************************${NC}"
echo -e "${GREEN}********Sandbox environment is ready!*********${NC}"
echo -e "${GREEN}**********************************************${NC}"
echo
# Displaying RPC and chainId info
echo -e "${BLUE}EVM Chain Information:${NC}"
echo -e "chain1:\n- bip44chainId: 1 \n- rpc: http://127.0.0.1:18545\n- chainId: 8888\n- symbol: ETH"
echo 

echo -e "chain2:\n- bip44chainId: 2 \n- rpc: http://127.0.0.1:28545\n- chainId: 9999\n- symbol: ETH"
echo 

# Displaying WmbGateway contract address
echo -e "${GREEN}WmbGateway Contract Address: ${RED}0xa383F3CDA8E2558AD843A288f468cA5D60ab686f ${NC}"
echo -e "${GREEN}Mock Cross Chain Token Address: ${RED}0xFac60b04D7Ade6de72d655413F5e029073baD621 ${NC}"
echo 

# Displaying built-in test account information
echo -e "${BLUE}Built-in Test Account Information:${NC}"
echo -e "id\tAddress\t\t\t\t\t\tPrivateKey"
echo -e "1)\t0x4E8a30f0db26251E992a8937099051F76a517117\t0x00856f7a9716aff5f0e52f1832df145967537ddc75864cbdbe9f0a856def2f3f"
echo -e "2)\t0x65D6A6b2De385Db524410BE169067A114704D868\t0x5f75902136cb4d3943c14cdcf9cbb9f293fdd7e47128e77db539d83492f84eb6"
echo -e "3)\t0x139280C8144959673AEc076842Fb1E6c560edE62\t0x3e9fff4ef6a895de9c32951a75b52d49371ba050b58eff0b992acc7954428c45"
echo -e "4)\t0x98581aEfe58265594aF5f54A5adc4Be0db2704F8\t0x6e6dc8e8f58f6829392ba1e00e5fc1a9c6a48abd62d491381d3eeb996599ac02"
# echo -e "5)\t0x5098E730Ca399634a0513b31ae12F26D405ecafd\t0xed90a083f22658db3b557a22832b5d719e65764eb3169053d96f6221725bbfd2" # for agent use only
echo 
echo -e "${BlUE}* Each address has 1,000,000 ETH and MCToken on chain1 and chain2${NC}"
echo -e "${RED}* Don't use Sandbox built-in test accounts in production!${NC}"
echo

echo -e "You can run ${GREEN}node ./sandbox/test.js ${NC} in another shell window to test the MCT cross-chain in sandbox."
echo
echo 

# Define a function to handle SIGINT
handle_sigint() {
    echo
    echo -e "${BLUE}Cleaning up the sandbox environment...${NC}"
    docker-compose down
    # docker rm wmb-chain1 wmb-chain2 wmb-agent
    exit 0
}

# Use the trap command to capture SIGINT and call the handle_sigint function
trap handle_sigint SIGINT

echo -e "${GREEN}* Press ${RED}Ctrl+C ${GREEN}to terminate and clean up the sandbox environment.${NC}"

# Use an infinite loop to keep the script running, waiting for the user to press Ctrl+C
while true; do
    sleep 1
done