import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useWeb3 } from "@/hooks/useWeb3";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// Helper function to get the correct Etherscan URL based on network
const getEtherscanUrl = (txHash: string): string => {
  // Default to Ethereum mainnet
  let baseUrl = "https://etherscan.io";
  
  // Check if we're on a local network or testnet
  if (window.ethereum) {
    const chainId = parseInt(window.ethereum.chainId, 16);
    
    // Map of chainIds to Etherscan URLs
    const etherscanUrls: Record<number, string> = {
      1: "https://etherscan.io",           // Mainnet
      5: "https://goerli.etherscan.io",    // Goerli
      11155111: "https://sepolia.etherscan.io", // Sepolia
      42161: "https://arbiscan.io",        // Arbitrum
      10: "https://optimistic.etherscan.io", // Optimism
      137: "https://polygonscan.com",      // Polygon
      56: "https://bscscan.com",           // Binance Smart Chain
      31337: "https://localhost:8545",     // Hardhat local
      1337: "https://localhost:8545"       // Local development
    };
    
    if (etherscanUrls[chainId]) {
      baseUrl = etherscanUrls[chainId];
    }
  }
  
  // Format the transaction URL - make sure we have a valid tx hash
  if (txHash && txHash.startsWith("0x") && txHash.length >= 42) {
    return `${baseUrl}/tx/${txHash}`;
  } else {
    // If we don't have a valid hash, just link to the main explorer
    return baseUrl;
  }
};

interface CustomerViewProps {
  addNotification: (type: "success" | "error" | "info", title: string, message: string) => void;
}

type Receipt = {
  id: string;
  retailer: string;
  date: string;
  category: string;
  amount: string;
  transactionHash: string;
  receiptHash: string;
  isVerified: boolean;
  items?: string;
  timestamp?: string;
};

const CustomerView = ({ addNotification }: CustomerViewProps) => {
  const { isConnected, getMyReceipts } = useWeb3();
  
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    loadReceipts();
  }, [isConnected]);
  
  // Listen for receipt issued events
  useEffect(() => {
    const handleReceiptIssued = () => {
      console.log("Receipt issued event detected - refreshing receipts");
      // Add a slight delay to allow the blockchain to update
      setTimeout(() => {
        loadReceipts();
        addNotification("info", "Refreshing Receipts", "Looking for your newly issued receipt...");
      }, 1000);
    };
    
    window.addEventListener("receiptIssued", handleReceiptIssued);
    
    return () => {
      window.removeEventListener("receiptIssued", handleReceiptIssued);
    };
  }, []);
  
  // Add a refresh button and poll for new receipts periodically
  useEffect(() => {
    if (isConnected) {
      // Set up a timer to refresh receipts every 15 seconds
      const refreshInterval = setInterval(() => {
        loadReceipts();
      }, 15000);
      
      // Clean up interval on unmount
      return () => clearInterval(refreshInterval);
    }
  }, [isConnected]);

  // Utility function to match retailer addresses to names
  function getRetailerName(address: string): string {
    const names: {[key: string]: string} = {
      "0x5FbDB2315678afecb367f032d93F642f64180aa3": "Electronic Depot",
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "City Diner",
      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "Fashion Outlet"
    };
    return names[address?.toLowerCase()] || "Unknown Retailer";
  }

  const loadReceipts = async () => {
    try {
      setIsLoading(true);
      
      // Get receipts from localStorage (our current storage method)
      const txRecords = JSON.parse(localStorage.getItem('transactionHashes') || '{}');
      const localReceipts = Object.values(txRecords);
      
      // Get receipts from blockchain by querying transaction history using Etherscan API
      let blockchainReceipts: any[] = [];
      
      if (window.ethereum && isConnected) {
        try {
          const provider = new (await import('ethers')).ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          
          console.log("Querying blockchain for receipts to address:", address);
          
          // Use Etherscan API to get transaction history for Sepolia testnet
          const etherscanApiUrl = `https://api-sepolia.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=YourApiKeyToken`;
          
          try {
            const response = await fetch(etherscanApiUrl);
            const data = await response.json();
            
            if (data.status === "1" && data.result) {
              // Filter transactions that have input data (our receipt transactions)
              const receiptTxs = data.result.filter((tx: any) => 
                tx.input && tx.input !== "0x" && tx.to === address.toLowerCase()
              );
              
              console.log("Found receipt transactions:", receiptTxs.length);
              
              // Process each transaction to extract receipt data
              for (const tx of receiptTxs) {
                try {
                  // Decode the hex data back to JSON
                  const hexData = tx.input.startsWith('0x') ? tx.input.slice(2) : tx.input;
                  const byteArray = hexData.match(/.{1,2}/g) || [];
                  const bytesArray = byteArray.map((byte: string) => parseInt(byte, 16));
                  const bytes = new Uint8Array(bytesArray);
                  const jsonString = new TextDecoder().decode(bytes);
                  const metadata = JSON.parse(jsonString);
                  
                  blockchainReceipts.push({
                    txHash: tx.hash,
                    buyerAddress: tx.to,
                    retailer: tx.from,
                    amount: metadata.amount || "0",
                    category: metadata.category || "general",
                    items: metadata.items || "",
                    date: metadata.date || new Date(parseInt(tx.timeStamp) * 1000).toLocaleDateString(),
                    timestamp: tx.timeStamp,
                    metadataHash: tx.input,
                    blockNumber: tx.blockNumber
                  });
                } catch (decodeError) {
                  console.log("Could not decode transaction data:", tx.hash, decodeError);
                }
              }
            }
          } catch (apiError) {
            console.log("Etherscan API not available, using local data only:", apiError);
          }
          
        } catch (error) {
          console.log("Could not load blockchain receipts:", error);
        }
      }
      
      // Try to get receipts from Web3 hook too
      try {
        if (getMyReceipts) {
          const web3Receipts = await getMyReceipts() || [];
          blockchainReceipts = [...blockchainReceipts, ...web3Receipts];
        }
      } catch (error) {
        console.log("Could not load Web3 receipts:", error);
      }
      
      // Combine all sources and remove duplicates
      const allReceipts = [...localReceipts, ...blockchainReceipts];
      const uniqueReceipts = allReceipts.filter((receipt, index, arr) => 
        arr.findIndex(r => r.txHash === receipt.txHash) === index
      );
      
      if (uniqueReceipts.length === 0) {
        setReceipts([]);
        setIsLoading(false);
        return;
      }
      
      // Transform all receipts to match our UI format
      const formattedReceipts: Receipt[] = allReceipts.map((receipt: any) => {
        // Try to parse the metadata hash to get more information if possible
        let category = "General";
        let amount = "N/A";
        let items = "";
        
        // Handle both localStorage receipts (which already have parsed data) and blockchain receipts
        if (receipt.category) {
          // This is from localStorage, already has parsed data
          category = receipt.category;
          amount = receipt.amount ? `$${receipt.amount}` : "N/A";
          items = receipt.items || "";
        } else if (receipt.metadataHash && receipt.metadataHash.startsWith("0x")) {
          // This is from blockchain, need to decode
          try {
            const hexString = receipt.metadataHash.slice(2); // Remove 0x prefix
            const byteArray = hexString.match(/.{1,2}/g) || [];
            const bytesArray = byteArray.map((byte: string) => parseInt(byte, 16));
            const bytes = new Uint8Array(bytesArray);
            const jsonString = new TextDecoder().decode(bytes);
            
            const metadata = JSON.parse(jsonString);
            category = metadata.category || "General";
            amount = metadata.amount ? `$${metadata.amount}` : "N/A";
            items = metadata.items || "";
          } catch (error) {
            console.warn("Could not parse metadata for receipt:", receipt.id, error);
          }
        }
        
        return {
          id: receipt.txHash || receipt.id?.toString() || Math.random().toString(),
          retailer: receipt.retailer || getRetailerName(receipt.retailer) || "Unknown Retailer",
          date: receipt.date || new Date(receipt.timestamp || Date.now()).toLocaleDateString(),
          category: category,
          amount: amount,
          items: items,
          transactionHash: receipt.txHash || "0x0000",
          receiptHash: receipt.metadataHash || "N/A",
          isVerified: true,
          timestamp: receipt.timestamp
        };
      });
      
      setReceipts(formattedReceipts);
    } catch (error) {
      console.error("Failed to load receipts:", error);
      addNotification("error", "Error Loading Receipts", "Failed to retrieve your receipts from the blockchain");
      setReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter receipts based on search and time filter
  const filteredReceipts = receipts.filter((receipt) => {
    // Search filter
    const matchesSearch = 
      receipt.retailer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.receiptHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.amount.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Time filter
    if (timeFilter === "all") return matchesSearch;
    
    const receiptDate = new Date(receipt.date);
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    if (timeFilter === "week" && receiptDate >= oneWeekAgo) return matchesSearch;
    if (timeFilter === "month" && receiptDate >= oneMonthAgo) return matchesSearch;
    if (timeFilter === "year" && receiptDate >= oneYearAgo) return matchesSearch;
    
    return false;
  });

  // Sort receipts
  const sortedReceipts = [...filteredReceipts].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">My Receipt Vault</h2>
            <p className="text-slate-600">View all receipts associated with your wallet address.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => loadReceipts()}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <i className="fas fa-sync-alt mr-2"></i>
              Refresh
            </button>
            <button 
              onClick={() => window.location.href = '/'} 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Home
            </button>
          </div>
        </div>
        
        {/* Receipt Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-slate-400"></i>
              </div>
              <input
                type="text"
                placeholder="Search receipts..."
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              className="block w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="year">Past Year</option>
            </select>
          </div>
          <div className="sm:w-48">
            <select
              className="block w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
        
        {/* Loading State */}
        {isLoading && (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-slate-600">Loading your receipts...</p>
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && sortedReceipts.length === 0 && (
          <div className="py-12 text-center">
            <div className="inline-block p-3 rounded-full bg-slate-100">
              <i className="fas fa-receipt text-3xl text-slate-400"></i>
            </div>
            <h3 className="mt-2 text-lg font-medium text-slate-700">No Receipts Found</h3>
            <p className="mt-1 text-slate-500">When retailers issue receipts to your wallet, they'll appear here.</p>
          </div>
        )}
        
        {/* Receipt List */}
        {!isLoading && sortedReceipts.length > 0 && (
          <div className="space-y-4">
            {sortedReceipts.map((receipt) => (
              <div key={receipt.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between">
                    <div>
                      <div className="flex items-center mb-1">
                        <i className="fas fa-store text-blue-500 mr-2"></i>
                        <h3 className="text-lg font-medium text-slate-800">{receipt.retailer}</h3>
                      </div>
                      <p className="text-sm text-slate-500 mb-3">{receipt.date}</p>
                      
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <i className="fas fa-tag text-xs mr-1"></i>
                          {receipt.category}
                        </span>
                        {receipt.isVerified && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <i className="fas fa-check-circle text-xs mr-1"></i>
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mb-4 sm:mb-0 sm:ml-4 sm:text-right">
                      <p className="text-sm text-slate-500">Receipt Total</p>
                      <p className="text-2xl font-bold text-slate-800">{receipt.amount}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <div className="mb-3 sm:mb-0">
                        <p className="text-sm font-medium text-slate-500">Transaction Hash</p>
                        <p className="font-mono text-xs bg-slate-100 py-1 px-2 rounded">
                          {receipt.transactionHash.substring(0, 6)}...{receipt.transactionHash.substring(receipt.transactionHash.length - 4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Receipt Hash</p>
                        <p className="font-mono text-xs bg-slate-100 py-1 px-2 rounded">
                          {receipt.receiptHash.substring(0, 6)}...{receipt.receiptHash.substring(receipt.receiptHash.length - 4)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <button
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => {
                        setSelectedReceipt(receipt);
                        setIsDetailsOpen(true);
                      }}
                    >
                      <i className="fas fa-receipt mr-2"></i>
                      View Details
                    </button>
                    <button 
                      className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => {
                        // Get the correct Etherscan URL based on network
                        const etherscanUrl = getEtherscanUrl(receipt.transactionHash);
                        window.open(etherscanUrl, '_blank');
                      }}
                    >
                      <i className="fas fa-external-link-alt mr-2"></i>
                      View on Blockchain
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipt Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          {selectedReceipt && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Receipt Details
                  {selectedReceipt.isVerified && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                      <i className="fas fa-check-circle mr-1"></i> Verified
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Full information about this blockchain-verified receipt
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div>
                  <h3 className="font-medium text-slate-700 mb-1">Retailer</h3>
                  <p className="text-slate-900">{selectedReceipt.retailer}</p>
                </div>
                <div>
                  <h3 className="font-medium text-slate-700 mb-1">Date</h3>
                  <p className="text-slate-900">{selectedReceipt.date}</p>
                </div>
                <div>
                  <h3 className="font-medium text-slate-700 mb-1">Amount</h3>
                  <p className="text-slate-900 font-semibold">{selectedReceipt.amount}</p>
                </div>
                <div>
                  <h3 className="font-medium text-slate-700 mb-1">Category</h3>
                  <p className="text-slate-900">{selectedReceipt.category}</p>
                </div>
                
                {selectedReceipt.items && (
                  <div className="col-span-2">
                    <h3 className="font-medium text-slate-700 mb-1">Items</h3>
                    <p className="text-slate-900">{selectedReceipt.items}</p>
                  </div>
                )}
                
                <div className="col-span-2 mt-2">
                  <h3 className="font-medium text-slate-700 mb-1">Transaction Hash</h3>
                  <div className="bg-slate-100 p-2 rounded font-mono text-xs break-all">
                    {selectedReceipt.transactionHash}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    This is the unique identifier for the blockchain transaction that recorded this receipt.
                  </p>
                </div>
                
                <div className="col-span-2">
                  <h3 className="font-medium text-slate-700 mb-1">Receipt Hash</h3>
                  <div className="bg-slate-100 p-2 rounded font-mono text-xs break-all">
                    {selectedReceipt.receiptHash}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    This hash represents the receipt data stored on the blockchain.
                  </p>
                </div>
              </div>
              
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <button
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => setIsDetailsOpen(false)}
                >
                  Close
                </button>
                <button
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => {
                    const etherscanUrl = getEtherscanUrl(selectedReceipt.transactionHash);
                    window.open(etherscanUrl, '_blank');
                  }}
                >
                  <i className="fas fa-external-link-alt mr-2"></i>
                  View on Blockchain
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerView;
