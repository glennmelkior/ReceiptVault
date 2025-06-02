import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import RoleSelection from "@/components/RoleSelection";
import RetailerView from "@/components/RetailerView";
import CustomerView from "@/components/CustomerView";
import Notification from "@/components/Notification";
type NotificationType = {
  type: "success" | "error" | "info";
  title: string;
  message: string;
  id: string;
};

export default function Home() {
  // Track wallet connection state in the component
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"retailer" | "customer" | null>(null);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  
  // Listen for wallet updates from the navbar component
  useEffect(() => {
    // Check localStorage on mount
    const storedWalletConnected = localStorage.getItem("walletConnected") === "true";
    const storedWalletAddress = localStorage.getItem("walletAddress");
    
    if (storedWalletConnected && storedWalletAddress) {
      setWalletConnected(true);
      setWalletAddress(storedWalletAddress);
    }
    
    // Listen for wallet connection updates
    const handleWalletUpdate = (event: any) => {
      console.log("Wallet update event received:", event.detail);
      setWalletConnected(event.detail.isConnected);
      setWalletAddress(event.detail.address);
    };
    
    window.addEventListener("walletUpdate", handleWalletUpdate);
    
    return () => {
      window.removeEventListener("walletUpdate", handleWalletUpdate);
    };
  }, []);

  const addNotification = (type: "success" | "error" | "info", title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 11);
    setNotifications((prev) => [...prev, { type, title, message, id }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };

  return (
    <div className="bg-slate-50 font-sans text-slate-800 min-h-screen">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!walletConnected ? (
          <div className="text-center py-20">
            <div className="inline-block p-6 bg-white rounded-lg shadow-md">
              <i className="fas fa-link-slash text-5xl text-slate-400 mb-4"></i>
              <h2 className="text-2xl font-bold text-slate-700 mb-2">Wallet Not Connected</h2>
              <p className="text-slate-600 mb-6">Connect your wallet to access ReceiptVault features</p>
              <button 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => {
                  const connectWalletEvent = new CustomEvent("connectWallet");
                  window.dispatchEvent(connectWalletEvent);
                }}
              >
                <i className="fas fa-wallet mr-2"></i>
                Connect Wallet
              </button>
            </div>
          </div>
        ) : (
          <div>
            {!userRole ? (
              <RoleSelection setUserRole={setUserRole} />
            ) : userRole === "retailer" ? (
              <RetailerView 
                addNotification={addNotification} 
                onBack={() => setUserRole(null)}
              />
            ) : (
              <CustomerView addNotification={addNotification} />
            )}
          </div>
        )}
      </main>

      {/* Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </div>
  );
}
