// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReceiptVault {
    struct Receipt {
        uint256 id;
        address retailer;
        address buyer;
        string metadataHash;
        uint256 timestamp;
        bool isVerified;
        string category;
        uint256 amount;
    }
    
    mapping(address => Receipt[]) private receiptsByBuyer;
    mapping(address => Receipt[]) private receiptsByRetailer;
    Receipt[] private allReceipts;
    uint256 private nextReceiptId = 1;
    
    event ReceiptIssued(
        uint256 indexed receiptId,
        address indexed retailer,
        address indexed buyer,
        string metadataHash,
        uint256 timestamp,
        string category,
        uint256 amount
    );
    
    function issueReceipt(
        address buyer, 
        string memory metadataHash,
        string memory category,
        uint256 amount
    ) public returns (uint256) {
        require(buyer != address(0), "Invalid buyer address");
        require(bytes(metadataHash).length > 0, "Metadata hash cannot be empty");
        
        Receipt memory newReceipt = Receipt({
            id: nextReceiptId,
            retailer: msg.sender,
            buyer: buyer,
            metadataHash: metadataHash,
            timestamp: block.timestamp,
            isVerified: true,
            category: category,
            amount: amount
        });
        
        receiptsByBuyer[buyer].push(newReceipt);
        receiptsByRetailer[msg.sender].push(newReceipt);
        allReceipts.push(newReceipt);
        
        uint256 currentReceiptId = nextReceiptId;
        nextReceiptId++;
        
        emit ReceiptIssued(
            currentReceiptId,
            msg.sender,
            buyer,
            metadataHash,
            block.timestamp,
            category,
            amount
        );
        
        return currentReceiptId;
    }
    
    function getReceipts() public view returns (Receipt[] memory) {
        uint256 relevantCount = 0;
        
        for (uint256 i = 0; i < allReceipts.length; i++) {
            if (allReceipts[i].buyer == msg.sender || allReceipts[i].retailer == msg.sender) {
                relevantCount++;
            }
        }
        
        Receipt[] memory result = new Receipt[](relevantCount);
        
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < allReceipts.length; i++) {
            if (allReceipts[i].buyer == msg.sender || allReceipts[i].retailer == msg.sender) {
                result[resultIndex] = allReceipts[i];
                resultIndex++;
            }
        }
        
        return result;
    }
    
    function getTotalReceiptCount() public view returns (uint256) {
        return allReceipts.length;
    }
}