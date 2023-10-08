# Wanchain Message Bridge Sandbox Guide
## Introduction
This guide will walk you through the process of setting up a local sandbox environment for the Wanchain Message Bridge. The sandbox environment will allow you to test the bridge without having to deploy your own Wanchain and Ethereum nodes. The sandbox environment will also allow you to test the bridge without having to wait for block confirmations. The sandbox environment is not intended for production use. The sandbox environment is intended for testing and development purposes only.
## Prerequisites
* Docker
* Docker Compose
* Git
* Node.js
* NPM
* yarn

## Installation
### Docker and Docker Compose
You have to install docker and docker-compose before use this sandbox environment. You can refer to [docker](https://docs.docker.com/install/) and [docker-compose](https://docs.docker.com/compose/install/) to install them.

Check docker and docker-compose version:
```bash
$ docker -v
Docker version 24.0.6, build ed223bc
$ docker-compose -v
Docker Compose version v2.22.0-desktop.2
```
If you have installed docker and docker-compose, you can see the version of them.

### Node.js and yarn
Install node.js and yarn:
```bash
# for Ubuntu
$ sudo apt-get install nodejs
$ sudo apt-get install npm
$ sudo npm install -g yarn

# for macOS
$ brew install node
$ sudo npm install -g yarn
```

Check node.js and yarn version:
```bash
$ node -v
v18.17.1
$ yarn -v
1.22.17
```
If you have installed node.js and yarn, you can see the version of them.

### Git
Install git from website: [git](https://git-scm.com/downloads)

Check git version:
```bash
$ git version
git version 2.37.1 (Apple Git-137.1)
```

### Clone the repository
Clone the repository:
```bash
$ git clone https://github.com/wanchain/message-bridge-contracts.git
```

### Install dependencies
Install dependencies:
```bash
$ cd message-bridge-contracts
$ yarn install
```

## Run the sandbox environment
Run the sandbox environment:
```bash
$ ./sandbox.sh
```
If you see the information below, it means the sandbox environment is running successfully.
```bash
$ ./sandbox.sh

Welcome to Wanchain Message Bridge Sandbox!

Please note: This script requires 'docker' and 'docker-compose' to be pre-installed.

Sandbox Environment Details:
2 Docker containers dedicated to independent EVM blockchains.
1 Docker container hosting an agent for cross-chain execution assistance.

Starting dockers please wait...
Deploying WmbGateway contracts, please wait...

**********************************************
********Sandbox environment is ready!*********
**********************************************

EVM Chain Information:
chain1:
- bip44chainId: 1
- rpc: http://127.0.0.1:18545
- chainId: 8888
- symbol: ETH

chain2:
- bip44chainId: 2
- rpc: http://127.0.0.1:28545
- chainId: 9999
- symbol: ETH

WmbGateway Contract Address: 0xa383F3CDA8E2558AD843A288f468cA5D60ab686f

Built-in Test Account Information (Each address has 1,000,000 ETH):
id	Address						PrivateKey
1)	0x4E8a30f0db26251E992a8937099051F76a517117	0x00856f7a9716aff5f0e52f1832df145967537ddc75864cbdbe9f0a856def2f3f
2)	0x65D6A6b2De385Db524410BE169067A114704D868	0x5f75902136cb4d3943c14cdcf9cbb9f293fdd7e47128e77db539d83492f84eb6
3)	0x139280C8144959673AEc076842Fb1E6c560edE62	0x3e9fff4ef6a895de9c32951a75b52d49371ba050b58eff0b992acc7954428c45
4)	0x98581aEfe58265594aF5f54A5adc4Be0db2704F8	0x6e6dc8e8f58f6829392ba1e00e5fc1a9c6a48abd62d491381d3eeb996599ac02

* Press Ctrl+C to terminate and clean up the sandbox environment.
```
You can use the RPC to connect to the chain1 and chain2.

such as add the sandbox test chain1 and chain2 network to your MetaMask wallet. 

The chain1 and chain2 have 1,000,000 ETH in the listed accounts. 

You can use the private key to import the account to your MetaMask wallet.

## Deploy your own contracts
The WmbGateway address and bip44chainId information was shown in the information above.

You can use the WmbGateway address and bip44chainId information to deploy your own contracts.


