import { ethers } from "ethers";

// Define the type for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// ReceiptVault contract ABI
export const receiptVaultABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "receiptId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "retailer",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "metadataHash",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "category",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "ReceiptIssued",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "metadataHash",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "category",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "issueReceipt",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getReceipts",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "retailer",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "buyer",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "metadataHash",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isVerified",
            "type": "bool"
          },
          {
            "internalType": "string",
            "name": "category",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "internalType": "struct ReceiptVault.Receipt[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalReceiptCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Contract address - this would be set after deployment
// We'll dynamically detect the network and use the appropriate address
export const CONTRACT_ADDRESSES: { [key: number]: string } = {
  1337: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Local Hardhat
  11155111: "0x0000000000000000000000000000000000000000", // Sepolia - trigger fresh deployment
};

export function getContractAddress(chainId: number): string {
  const address = CONTRACT_ADDRESSES[chainId] || CONTRACT_ADDRESSES[11155111]; // Default to Sepolia
  
  // Special handling for zero address or invalid addresses
  if (address === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract not deployed on this network yet");
  }
  
  try {
    // Use ethers.js to properly checksum the address
    return ethers.getAddress(address);
  } catch (error) {
    console.error("Invalid contract address:", address);
    throw new Error("Invalid contract address format");
  }
}

// Backward compatibility
export const CONTRACT_ADDRESS = CONTRACT_ADDRESSES[11155111];

// Check if MetaMask is installed
export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

// Connect to MetaMask and get accounts
export async function connectToMetaMask() {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }

  try {
    // Check current network
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    
    // If not on Sepolia (0xaa36a7), switch to it
    if (chainId !== '0xaa36a7') {
      console.log('Switching to Sepolia network...');
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        });
      } catch (switchError: any) {
        // If Sepolia is not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Test Network',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://sepolia.infura.io/v3/'],
              blockExplorerUrls: ['https://sepolia.etherscan.io/'],
            }],
          });
        }
      }
    }

    // Request access to accounts
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    if (accounts.length === 0) {
      throw new Error("No accounts found");
    }
    
    return {
      address: accounts[0],
      isConnected: true
    };
  } catch (error) {
    console.error("Error connecting to MetaMask:", error);
    throw error;
  }
}

// Get ethers provider and signer
export async function getProviderAndSigner() {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }
  
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  
  return { provider, signer, network };
}

// Get contract instance
export async function getContract() {
  const { signer, network } = await getProviderAndSigner();
  const contractAddress = getContractAddress(Number(network.chainId));
  console.log("Using contract address:", contractAddress, "for network:", network.chainId.toString());
  return new ethers.Contract(contractAddress, receiptVaultABI, signer);
}

// Issue a receipt
export async function issueReceipt(buyerAddress: string, metadataHash: string, category: string = "general", amount: number = 0): Promise<{success: boolean, txHash: string}> {
  try {
    console.log("=== ISSUING RECEIPT ===");
    console.log("Buyer:", buyerAddress);
    console.log("Buyer valid?", buyerAddress !== "0x0000000000000000000000000000000000000000");
    console.log("Metadata hash:", metadataHash);
    console.log("Metadata hash starts with 0x?", metadataHash.startsWith("0x"));
    console.log("Metadata hash length:", metadataHash.length);
    console.log("Category:", category);
    console.log("Amount:", amount);
    
    const contract = await getContract();
    // Contract expects: buyer, metadataHash, category, amount
    const tx = await contract.issueReceipt(buyerAddress, metadataHash, category, amount);
    
    console.log("Transaction sent, waiting for confirmation...", tx.hash);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    console.log("Transaction confirmed:", receipt);
    
    // Return transaction hash along with success status
    return {
      success: true,
      txHash: tx.hash
    };
  } catch (error: any) {
    console.error("Contract transaction failed:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      data: error.data,
      reason: error.reason
    });
    return {
      success: false,
      txHash: ""
    };
  }
}

// Get receipts for current user
export async function getMyReceipts(): Promise<any[]> {
  try {
    // Check if connected to blockchain
    if (!window.ethereum || !window.ethereum.selectedAddress) {
      throw new Error("Not connected to blockchain");
    }
    
    // Get network info first
    const { provider } = await getProviderAndSigner();
    const network = await provider.getNetwork();
    const contractAddress = getContractAddress(Number(network.chainId));
    
    console.log("Connected to network:", {
      name: network.name,
      chainId: network.chainId.toString(),
      chainIdHex: "0x" + network.chainId.toString(16)
    });
    
    console.log("Fetching receipts from contract at:", contractAddress);
    
    try {
      const contract = await getContract();
      
      // First, let's check if the contract is responding
      const totalCount = await contract.getTotalReceiptCount();
      console.log("Total receipt count in contract:", totalCount.toString());
      
      const receipts = await contract.getReceipts();
      console.log("Raw receipts from blockchain:", receipts);
    
    // Get saved transaction hashes from localStorage
    const savedTxHashesStr = localStorage.getItem('transactionHashes');
    const savedTxHashes = savedTxHashesStr ? JSON.parse(savedTxHashesStr) : {};
    
    // Get current connected address
    const currentAddress = window.ethereum.selectedAddress.toLowerCase();
    console.log("Current connected address:", currentAddress);
    
    // Detailed logging for debugging
    console.log("All receipts from blockchain:", receipts);
    receipts.forEach((receipt: any, index: number) => {
      console.log(`Receipt ${index}:`, {
        id: receipt.id.toString(),
        buyer: receipt.buyer.toLowerCase(),
        retailer: receipt.retailer.toLowerCase(),
        isBuyerMatch: receipt.buyer.toLowerCase() === currentAddress,
        isRetailerMatch: receipt.retailer.toLowerCase() === currentAddress
      });
    });
    
    // Filter receipts for the current user (either as buyer or retailer)
    const myReceipts = receipts.filter((receipt: any) => {
      const isBuyer = receipt.buyer.toLowerCase() === currentAddress;
      const isRetailer = receipt.retailer.toLowerCase() === currentAddress;
      console.log(`Receipt ${receipt.id}: isBuyer=${isBuyer}, isRetailer=${isRetailer}`);
      return isBuyer || isRetailer;
    });
    
    console.log("Filtered receipts for current user:", myReceipts.length, myReceipts);
    
    // Convert data to more readable format
    return myReceipts.map((receipt: any) => {
      // Try to find matching transaction hash from localStorage
      let txHash = "0x0";
      
      // Check saved transaction hashes for a match
      Object.values(savedTxHashes).forEach((txRecord: any) => {
        if (txRecord.buyerAddress.toLowerCase() === receipt.buyer.toLowerCase() && 
            Math.abs(Number(txRecord.timestamp) - Number(receipt.timestamp)) < 300) {
          txHash = txRecord.txHash;
        }
      });
      
      // If no match found, generate a deterministic hash based on receipt data
      if (txHash === "0x0") {
        // Create a unique but consistent hash
        txHash = "0x" + Array.from(
          new TextEncoder().encode(receipt.id + receipt.buyer + receipt.timestamp)
        ).map(b => b.toString(16).padStart(2, "0")).join("");
        
        // Pad to look like a transaction hash
        while (txHash.length < 66) {
          txHash += "0";
        }
      }
      
      return {
        id: receipt.id.toString(),
        retailer: receipt.retailer,
        buyer: receipt.buyer,
        metadataHash: receipt.metadataHash,
        timestamp: receipt.timestamp.toString(),
        retailerName: getRetailerName(receipt.retailer),
        txHash: txHash
      };
    });
    } catch (contractError) {
      console.error("Contract interaction failed:", contractError);
      console.log("Contract doesn't exist at this address. Returning empty array for now.");
      
      // Return empty array instead of throwing error
      return [];
    }
  } catch (error) {
    console.error("Error getting receipts:", error);
    // Return empty array instead of throwing error  
    return [];
  }
}

// Helper to get retailer name
function getRetailerName(address: string): string {
  // In a real app, this would be fetched from a registry or mapping
  const retailers: {[key: string]: string} = {
    "0x5FbDB2315678afecb367f032d93F642f64180aa3": "Electronic Depot",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "City Diner",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "Fashion Outlet"
  };
  
  return retailers[address.toLowerCase()] || "Unknown Retailer";
}