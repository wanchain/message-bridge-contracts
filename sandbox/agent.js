const { ethers } = require("ethers");

// Chain configurations
const chains = [
  {
    bip44chainId: 1,
    rpc: "http://wmb-chain1:18545",
    chainId: 8888,
    symbol: "ETH",
  },
  {
    bip44chainId: 2,
    rpc: "http://wmb-chain2:28545",
    chainId: 9999,
    symbol: "ETH",
  },
];

// Sandbox PRIVATE_KEY do not use in production
const PRIVATE_KEY =
  "0xed90a083f22658db3b557a22832b5d719e65764eb3169053d96f6221725bbfd2";

// Contract address
const WmbGatewayAddress = "0xa383F3CDA8E2558AD843A288f468cA5D60ab686f";

// ABI for events
const abi = require("./abi.json");

// Processed events cache
let processedEvents = {};

// Check if event has been processed
function isEventProcessed(event) {
  return processedEvents[event.transactionHash] ? true : false;
}

// Cache the processed event
function cacheProcessedEvent(event) {
  processedEvents[event.transactionHash] = true;
}

async function scanEvents(provider, fromBip44chainId) {
  const contract = new ethers.Contract(WmbGatewayAddress, abi, provider);

  // Filter for the events
  const filter1 = contract.filters.MessageDispatched();
  const filter2 = contract.filters.MessageBatchDispatched();

  // Get the latest block
  const latestBlock = await provider.getBlockNumber();

  // Get events from the latest block
  const events1 = await contract.queryFilter(filter1, 0, latestBlock);
  const events2 = await contract.queryFilter(filter2, 0, latestBlock);

  // Process each event
  for (const event of events1.concat(events2)) {
    if (!isEventProcessed(event)) {
      try {
        await processEvent(event, fromBip44chainId, provider);
      } catch (error) {
        console.log('ERROR:', error);
      }
      cacheProcessedEvent(event);
    }
  }
}

async function processEvent(event, fromBip44chainId, fromProvider) {
  console.log("New event found:", event);
  // TODO: Add your logic for processing the event
  if (event.event === "MessageDispatched") {
    console.log("MessageDispatched");
    let toBip44chainId = Number(event.args.toChainId.toString());
    console.log('fromBip44chainId', fromBip44chainId);
    console.log("toBip44chainId", toBip44chainId);
    console.log('messageId', event.args.messageId);
    let toChain = chains.find((chain) => chain.bip44chainId === toBip44chainId);
    let provider = new ethers.providers.JsonRpcProvider(toChain.rpc);
    let wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    let contract = new ethers.Contract(WmbGatewayAddress, abi, wallet);
    let fromContract = new ethers.Contract(WmbGatewayAddress, abi, fromProvider);
    let gasLimit = await fromContract.messageGasLimit(event.args.messageId);
    let tx = await contract.receiveMessage(
      event.args.messageId,
      fromBip44chainId,
      event.args.from,
      event.args.to,
      event.args.data,
      gasLimit,
      '0x1234567890123456789012345678901234567890123456789012345678901234',
      '0x',
      '0x1234567890123456789012345678901234567890123456789012345678901234'
    );
    tx = await tx.wait();
    console.log("Message FINISHED", tx);
  }

  if (event.event === "MessageBatchDispatched") {
    console.log("MessageBatchDispatched");
    let toBip44chainId = Number(event.args.toChainId.toString());
    console.log('fromBip44chainId', fromBip44chainId);
    console.log("toBip44chainId", toBip44chainId);
    console.log('messageId', event.args.messageId);
    let toChain = chains.find((chain) => chain.bip44chainId === toBip44chainId);
    let provider = new ethers.providers.JsonRpcProvider(toChain.rpc);
    let wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    let contract = new ethers.Contract(WmbGatewayAddress, abi, wallet);
    let fromContract = new ethers.Contract(WmbGatewayAddress, abi, fromProvider);
    let gasLimit = await fromContract.messageGasLimit(event.args.messageId);
    let tx = await contract.receiveBatchMessage(
      event.args.messageId,
      fromBip44chainId,
      event.args.from,
      event.args.messages,
      gasLimit,
      '0x1234567890123456789012345678901234567890123456789012345678901234',
      '0x',
      '0x1234567890123456789012345678901234567890123456789012345678901234'
    );
    tx = await tx.wait();
    console.log("Message FINISHED", tx);
  }
}


async function main() {
  console.log("Starting agent...");
  // Create a loop for each chain
  for (const chain of chains) {
    const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
    // Use setInterval to check every 5 seconds
    setInterval(async () => {
      await scanEvents(provider, chain.bip44chainId);
    }, 5000);
  }
  console.log("Agent started!");
}

main().catch((error) => {
  console.error("Error encountered:", error);
});
