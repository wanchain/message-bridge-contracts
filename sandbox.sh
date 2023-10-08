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

# Displaying RPC and chainId info
echo -e "${BLUE}EVM Chain Information:${NC}"
echo -e "chain1:\n- bip44chainId: 1 \n- rpc: http://127.0.0.1:18545\n- chainId: 8888\n- symbol: ETH"
echo 

echo -e "chain2:\n- bip44chainId: 2 \n- rpc: http://127.0.0.1:28545\n- chainId: 9999\n- symbol: ETH"
echo 

# Displaying WmbGateway contract address
echo -e "${GREEN}WmbGateway Contract Address: XXXXXXX (You can update this later)${NC}"
echo 

# Displaying built-in test account information
echo -e "${BLUE}Built-in Test Account Information (Each address has 1,000,000 ETH):${NC}"
echo -e "id\tAddress\t\t\t\t\t\tPrivateKey"
echo -e "1)\t0x4E8a30f0db26251E992a8937099051F76a517117\t0x00856f7a9716aff5f0e52f1832df145967537ddc75864cbdbe9f0a856def2f3f"
echo -e "2)\t0x65D6A6b2De385Db524410BE169067A114704D868\t0x5f75902136cb4d3943c14cdcf9cbb9f293fdd7e47128e77db539d83492f84eb6"
echo -e "3)\t0x139280C8144959673AEc076842Fb1E6c560edE62\t0x3e9fff4ef6a895de9c32951a75b52d49371ba050b58eff0b992acc7954428c45"
echo -e "4)\t0x98581aEfe58265594aF5f54A5adc4Be0db2704F8\t0x6e6dc8e8f58f6829392ba1e00e5fc1a9c6a48abd62d491381d3eeb996599ac02"
# echo -e "5)\t0x5098E730Ca399634a0513b31ae12F26D405ecafd\t0xed90a083f22658db3b557a22832b5d719e65764eb3169053d96f6221725bbfd2" # for agent use only
echo 

# Added Instructions
echo -e "${BLUE}If you want to stop the Sandbox, please use the '${GREEN}docker-compose stop${BLUE}' command.${NC}"
echo -e "${BLUE}If you want to remove the Sandbox, please use the '${GREEN}docker-compose down -v${BLUE}' command.${NC}"
echo -e "${BLUE}To see the stopped containers, use '${GREEN}docker ps -a${BLUE}'. To remove a container, use '${RED}docker rm <containerId>${BLUE}'.${NC}"
