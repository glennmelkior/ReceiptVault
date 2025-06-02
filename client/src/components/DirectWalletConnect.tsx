import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface WalletConnectProps {
  onConnectionUpdate: (isConnected: boolean, address: string | null) => void;
}

export default function DirectWalletConnect({ onConnectionUpdate }: WalletConnectProps) {
  const [walletState, setWalletState] = useState({
    isConnected: false,
    account: null as string | null,
    isConnecting: false
  });

  console.log("DirectWalletConnect render:", { isConnected: walletState.isConnected, account: walletState.account });

  // Update parent component when connection state changes
  useEffect(() => {
    console.log("Wallet connection updated:", walletState.isConnected, walletState.account);
    onConnectionUpdate(walletState.isConnected, walletState.account);
  }, [walletState.isConnected, walletState.account, onConnectionUpdate]);

  const handleConnect = async () => {
    console.log("Connect button clicked");
    
    if (!window.ethereum) {
      alert('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setWalletState(prev => ({ ...prev, isConnecting: true }));

    try {
      console.log("Requesting wallet connection...");
      
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
        console.log("Successfully connected to:", address);
        
        // Update state immediately
        setWalletState({
          isConnected: true,
          account: address,
          isConnecting: false
        });
        
        console.log("Wallet state updated - UI should now show connected");
      } else {
        throw new Error('No accounts returned from MetaMask');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setWalletState(prev => ({ ...prev, isConnecting: false }));
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const handleDisconnect = () => {
    console.log("Disconnecting wallet");
    setWalletState({
      isConnected: false,
      account: null,
      isConnecting: false
    });
  };

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            console.log("Found existing connection:", accounts[0]);
            setWalletState({
              isConnected: true,
              account: accounts[0],
              isConnecting: false
            });
          }
        } catch (error) {
          console.error("Error checking existing connection:", error);
        }
      }
    };

    checkConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('MetaMask accounts changed:', accounts);
        if (accounts.length === 0) {
          setWalletState({
            isConnected: false,
            account: null,
            isConnecting: false
          });
        } else {
          setWalletState({
            isConnected: true,
            account: accounts[0],
            isConnecting: false
          });
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  if (walletState.isConnected && walletState.account) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="font-medium">{truncateAddress(walletState.account)}</span>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={walletState.isConnecting}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      {walletState.isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}