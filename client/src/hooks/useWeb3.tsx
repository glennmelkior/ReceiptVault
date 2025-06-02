import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { ethers } from "ethers";
import { 
  receiptVaultABI, 
  CONTRACT_ADDRESS, 
  issueReceipt as issueReceiptOnChain,
  getMyReceipts as getReceiptsFromChain
} from "@/lib/MetaMaskUtils";

interface Web3ContextType {
  isConnected: boolean;
  account: string | null;
  chainId: bigint | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  contract: ethers.Contract | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  issueReceipt: (buyerAddress: string, metadataHash: string, category?: string, amount?: number) => Promise<{success: boolean, txHash: string}>;
  getMyReceipts: () => Promise<any[]>;
}

const Web3Context = createContext<Web3ContextType>({
  isConnected: false,
  account: null,
  chainId: null,
  provider: null,
  signer: null,
  contract: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  issueReceipt: async () => ({ success: false, txHash: "" }),
  getMyReceipts: async () => []
});

export const useWeb3 = () => useContext(Web3Context);

interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider = ({ children }: Web3ProviderProps) => {
  const [walletState, setWalletState] = useState({
    isConnected: false,
    account: null as string | null,
    chainId: null as bigint | null,
    provider: null as ethers.BrowserProvider | null,
    signer: null as ethers.Signer | null,
    contract: null as ethers.Contract | null
  });

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }

    try {
      console.log("Connecting wallet...");
      
      // Request fresh wallet selection
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (permError) {
        console.log("Permission request failed, falling back to requestAccounts");
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        console.log("Connected to account:", address);
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const network = await provider.getNetwork();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, receiptVaultABI, signer);
        
        // Update all state in one operation
        setWalletState({
          isConnected: true,
          account: address,
          chainId: network.chainId,
          provider,
          signer,
          contract
        });
        
        sessionStorage.setItem("userConnectedThisSession", "true");
        
        console.log("Wallet connected successfully - UI should update now");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      throw error;
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    console.log("Disconnecting wallet...");
    setWalletState({
      isConnected: false,
      account: null,
      chainId: null,
      provider: null,
      signer: null,
      contract: null
    });
    sessionStorage.removeItem("userConnectedThisSession");
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('Accounts changed:', accounts);
        const userConnectedThisSession = sessionStorage.getItem("userConnectedThisSession") === "true";
        
        if (userConnectedThisSession) {
          if (accounts.length === 0) {
            disconnectWallet();
          } else if (accounts[0] !== walletState.account) {
            connectWallet();
          }
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [walletState.account, connectWallet, disconnectWallet]);

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      const userConnectedThisSession = sessionStorage.getItem("userConnectedThisSession") === "true";
      
      if (userConnectedThisSession && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            await connectWallet();
          } else {
            sessionStorage.removeItem("userConnectedThisSession");
          }
        } catch (error) {
          console.error("Error checking connection:", error);
          sessionStorage.removeItem("userConnectedThisSession");
        }
      }
    };

    checkConnection();
  }, [connectWallet]);

  const issueReceipt = useCallback(async (buyerAddress: string, metadataHash: string, category: string = "general", amount: number = 0): Promise<{success: boolean, txHash: string}> => {
    if (!walletState.contract || !walletState.signer || !walletState.isConnected) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      const result = await issueReceiptOnChain(buyerAddress, metadataHash, category, amount);
      return result;
    } catch (error) {
      console.error("Error issuing receipt:", error);
      throw error;
    }
  }, [walletState.contract, walletState.signer, walletState.isConnected]);

  const getMyReceipts = useCallback(async (): Promise<any[]> => {
    if (!walletState.contract || !walletState.signer || !walletState.isConnected) {
      console.log("Wallet not connected, returning empty receipts");
      return [];
    }

    try {
      const receipts = await getReceiptsFromChain();
      
      if (walletState.account) {
        const filteredReceipts = receipts.filter((receipt: any) => {
          return receipt.buyer?.toLowerCase() === walletState.account?.toLowerCase() || 
                receipt.retailer?.toLowerCase() === walletState.account?.toLowerCase();
        });
        return filteredReceipts;
      }
      
      return receipts;
    } catch (error) {
      console.error("Error getting receipts:", error);
      return [];
    }
  }, [walletState.contract, walletState.signer, walletState.isConnected, walletState.account]);

  return (
    <Web3Context.Provider
      value={{
        isConnected: walletState.isConnected,
        account: walletState.account,
        chainId: walletState.chainId,
        provider: walletState.provider,
        signer: walletState.signer,
        contract: walletState.contract,
        connectWallet,
        disconnectWallet,
        issueReceipt,
        getMyReceipts
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};