import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ethers } from "ethers";
import { receiptVaultABI, CONTRACT_ADDRESS } from "@/lib/MetaMaskUtils";

interface RetailerViewProps {
  addNotification: (type: "success" | "error" | "info", title: string, message: string) => void;
  onBack?: () => void;
}

const RetailerView = ({ addNotification, onBack }: RetailerViewProps) => {
  const [, setLocation] = useLocation();
  const [walletState, setWalletState] = useState({
    isConnected: false,
    account: null as string | null
  });
  
  const [buyerAddress, setBuyerAddress] = useState("");
  const [receiptDetails, setReceiptDetails] = useState({
    amount: "",
    category: "general",
    items: "",
    date: new Date().toISOString().split("T")[0]
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check wallet connection on mount
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setWalletState({
              isConnected: true,
              account: accounts[0]
            });
          }
        } catch (error) {
          console.error("Error checking wallet connection:", error);
        }
      }
    };

    checkWalletConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setWalletState({
            isConnected: false,
            account: null
          });
        } else {
          setWalletState({
            isConnected: true,
            account: accounts[0]
          });
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  const issueReceiptOnChain = async (buyerAddress: string, metadataHash: string, category: string, amount: number) => {
    if (!window.ethereum || !walletState.isConnected) {
      throw new Error("Wallet not connected");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();
    
    console.log("Connected to network:", network.name, "Chain ID:", network.chainId);
    
    // Check if we're on the right network (Sepolia testnet)
    if (network.chainId !== BigInt(11155111)) {
      throw new Error(`Please switch to Sepolia testnet. Currently connected to chain ID: ${network.chainId}`);
    }
    
    // For now, let's just create a simple transaction to demonstrate the receipt system
    // This sends the receipt metadata directly as transaction data
    console.log("Creating receipt transaction with metadata...");
    
    const tx = await signer.sendTransaction({
      to: buyerAddress,
      value: 0, // No ETH transfer, just data
      data: metadataHash,
      gasLimit: 50000 // Sufficient gas for data transaction
    });
    
    console.log("Receipt transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Receipt transaction confirmed:", receipt);
    
    return { success: true, txHash: tx.hash };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!buyerAddress) {
      addNotification("error", "Missing Field", "Please enter a buyer wallet address");
      return;
    }

    try {
      setIsLoading(true);

      // Validate that we have a connected wallet
      console.log("RetailerView - Wallet check:", { isConnected: walletState.isConnected, account: walletState.account, hasContract: !!issueReceiptOnChain });
      if (!walletState.isConnected || !walletState.account) {
        addNotification("error", "Wallet Not Connected", "Please connect your wallet first");
        setIsLoading(false);
        return;
      }

      // Create a receipt metadata object
      const metadata = {
        retailer: walletState.account,
        amount: receiptDetails.amount || "0.00",
        category: receiptDetails.category || "general",
        items: receiptDetails.items || "",
        date: receiptDetails.date || new Date().toISOString().split("T")[0],
        timestamp: Math.floor(Date.now() / 1000)
      };

      // Convert metadata to JSON string and then to hex string (simulating IPFS hash)
      const metadataString = JSON.stringify(metadata);
      const metadataHash = "0x" + Array.from(new TextEncoder().encode(metadataString))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      console.log("Issuing receipt with metadata:", metadata);
      console.log("Metadata hash:", metadataHash);
      console.log("Metadata hash length:", metadataHash.length);
      
      // Issue receipt directly to blockchain
      const amountValue = Math.round(parseFloat(receiptDetails.amount || "0"));
      
      const { success, txHash } = await issueReceiptOnChain(
        buyerAddress, 
        metadataHash, 
        receiptDetails.category || "general",
        amountValue
      );

      if (success) {
        // Store transaction hash in localStorage for future reference
        const txRecords = JSON.parse(localStorage.getItem('transactionHashes') || '{}');
        txRecords[txHash] = {
          buyerAddress,
          ...metadata,
          txHash,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('transactionHashes', JSON.stringify(txRecords));

        addNotification("success", "Receipt Issued Successfully!", 
          `Transaction Hash: ${txHash.substring(0, 10)}...`);
        
        // Reset form
        setBuyerAddress("");
        setReceiptDetails({
          amount: "",
          category: "general",
          items: "",
          date: new Date().toISOString().split("T")[0]
        });

        // Navigate back to home after 2 seconds
        setTimeout(() => {
          setLocation("/");
        }, 2000);
      }
    } catch (err: any) {
      console.error("Error issuing receipt:", err);
      console.error("Error details:", { 
        message: err.message, 
        code: err.code, 
        reason: err.reason, 
        stack: err.stack,
        name: err.name,
        ...(err.error && { innerError: err.error })
      });
      addNotification("error", "Transaction Failed", 
        err.message || "Failed to issue receipt on blockchain");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Issue Receipt</h1>
          <button 
            onClick={() => onBack ? onBack() : setLocation("/")}
            className="text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            ← Back to Home
          </button>
        </div>

        {/* Wallet Status */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Wallet Status</h3>
          {walletState.isConnected ? (
            <div className="text-green-600">
              ✅ Connected: {walletState.account?.substring(0, 10)}...
            </div>
          ) : (
            <div className="text-red-600">
              ❌ Not connected - Please connect your wallet from the home page
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Buyer Address */}
          <div>
            <label htmlFor="buyerAddress" className="block text-sm font-medium text-gray-700 mb-2">
              Buyer Wallet Address *
            </label>
            <input
              type="text"
              id="buyerAddress"
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              placeholder="0x..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Receipt Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <input
                type="number"
                id="amount"
                step="0.01"
                value={receiptDetails.amount}
                onChange={(e) => setReceiptDetails(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category"
                value={receiptDetails.category}
                onChange={(e) => setReceiptDetails(prev => ({ ...prev, category: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="general">General</option>
                <option value="food">Food & Dining</option>
                <option value="transport">Transportation</option>
                <option value="entertainment">Entertainment</option>
                <option value="shopping">Shopping</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              id="date"
              value={receiptDetails.date}
              onChange={(e) => setReceiptDetails(prev => ({ ...prev, date: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="items" className="block text-sm font-medium text-gray-700 mb-2">
              Items/Description (Optional)
            </label>
            <textarea
              id="items"
              value={receiptDetails.items}
              onChange={(e) => setReceiptDetails(prev => ({ ...prev, items: e.target.value }))}
              placeholder="Describe the items or services..."
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !walletState.isConnected}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? "Processing..." : "Issue Receipt on Blockchain"}
          </button>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">How it works:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Your receipt metadata is encoded and stored on Sepolia testnet</li>
            <li>• Each receipt gets a unique transaction hash for verification</li>
            <li>• Both you and the buyer can verify the receipt later</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RetailerView;