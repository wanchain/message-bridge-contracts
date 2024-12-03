# How to use the TokenBridgeV2 contract

Step 1. deploy the ERC20TokenHome contract on the home chain.
Step 2. deploy the ERC20TokenHome contract on the remote chain.
Step 3. config the token remote address by calling the configTokenRemote function on the home chain.
Step 4. send token by calling the send() function to cross token from home chain to remote chain.
Step 5. send token by calling the send() function to cross token from remote chain to home chain.