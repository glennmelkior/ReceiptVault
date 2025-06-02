
# Receipt Vault - Blockchain Receipt Management System

A decentralized application for issuing and managing digital receipts on the Sepolia testnet.

## Features

- Connect MetaMask wallet
- Issue receipts on blockchain (retailer view)
- View receipts (customer view)
- Deployed on Sepolia testnet

## Prerequisites

- Node.js (version 18 or higher)
- MetaMask browser extension
- Sepolia testnet ETH

## Setup Instructions

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   Create a `.env` file in the root directory:
   ```
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key
   SEPOLIA_PRIVATE_KEY=your-private-key-for-deployment
   ```

3. **Run the application:**
   ```bash
   npm run dev
   ```

4. **Access the app:**
   Open your browser to `http://localhost:5000`

## MetaMask Setup

- Network: Sepolia testnet
- Chain ID: 11155111

## Contract

The ReceiptVault contract is deployed on Sepolia testnet. The contract address is hardcoded in `client/src/lib/MetaMaskUtils.ts`.

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Blockchain**: Ethereum (Sepolia testnet)
- **Smart Contract**: Solidity

## Core Files

- `client/src/main.tsx` - App entry point
- `client/src/hooks/useWeb3.tsx` - Web3 wallet integration
- `client/src/lib/MetaMaskUtils.ts` - Contract interaction
- `contracts/ReceiptVault.sol` - Smart contract
- `final-deploy.mjs` - Deployment script
- `server/index.ts` - Express server

## Usage

1. Connect your MetaMask wallet
2. Switch between Retailer and Customer views
3. Retailers can issue receipts to customer addresses
4. Customers can view all their receipts
