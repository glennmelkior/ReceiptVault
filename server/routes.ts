import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as path from 'path';
import * as fs from 'fs';

export async function registerRoutes(app: Express): Promise<Server> {
  // API endpoint to get contract ABI
  app.get('/api/contract/abi', (req, res) => {
    try {
      const abiPath = path.join(process.cwd(), 'artifacts/contracts/ReceiptVault.sol/ReceiptVault.json');
      
      // Check if the file exists
      if (fs.existsSync(abiPath)) {
        const contractJSON = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        res.json({ abi: contractJSON.abi });
      } else {
        // If file doesn't exist, return the embedded ABI
        const embeddedABI = [
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
              }
            ],
            "name": "issueReceipt",
            "outputs": [],
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
        
        res.json({ abi: embeddedABI });
      }
    } catch (error) {
      console.error('Error fetching contract ABI:', error);
      res.status(500).json({ error: 'Failed to fetch contract ABI' });
    }
  });

  // API endpoint to get contract address
  app.get('/api/contract/address', (req, res) => {
    // In a production environment, this would be read from a configuration file
    // or environment variable after deployment
    res.json({
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' // Default local Hardhat deployment address
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
