// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * 投票资格链上验证合约
 * 集成零知识证明验证器，用于链上验证投票资格
 */
contract VotingEligibilityVerifier {
    // 验证器合约地址（部署后需要设置）
    address public verifierContract;
    
    // 管理员地址
    address public admin;
    
    // 记录已验证的证明（防止重放攻击）
    mapping(bytes32 => bool) public verifiedProofs;
    
    // 验证记录
    struct VerificationRecord {
        uint256 voteId;
        address voter;
        uint256 timestamp;
        bool isValid;
    }
    
    // 验证历史记录
    mapping(bytes32 => VerificationRecord) public verificationHistory;
    
    // 事件
    event ProofVerified(
        bytes32 indexed proofHash,
        uint256 indexed voteId,
        address indexed voter,
        bool isValid,
        uint256 timestamp
    );
    
    event VerifierContractUpdated(
        address indexed oldVerifier,
        address indexed newVerifier,
        uint256 timestamp
    );
    
    constructor() {
        admin = msg.sender;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    /**
     * 设置验证器合约地址
     * @param _verifierContract 验证器合约地址
     */
    function setVerifierContract(address _verifierContract) external onlyAdmin {
        require(_verifierContract != address(0), "Invalid verifier contract address");
        address oldVerifier = verifierContract;
        verifierContract = _verifierContract;
        emit VerifierContractUpdated(oldVerifier, _verifierContract, block.timestamp);
    }
    
    /**
     * 链上验证零知识证明
     * @param a 证明的 a 部分
     * @param b 证明的 b 部分
     * @param c 证明的 c 部分
     * @param input 公共输入信号（9个：8个规则输入 + 1个输出）
     * @param voteId 投票ID
     * @return isValid 验证是否成功
     */
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[9] memory input,
        uint256 voteId
    ) external returns (bool isValid) {
        require(verifierContract != address(0), "Verifier contract not set");
        
        // 计算证明哈希（防止重放攻击）
        bytes32 proofHash = keccak256(abi.encodePacked(a, b, c, input, voteId, msg.sender));
        require(!verifiedProofs[proofHash], "Proof already verified");
        
        // 调用验证器合约进行验证
        (bool success, bytes memory data) = verifierContract.call(
            abi.encodeWithSignature(
                "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[9])",
                a, b, c, input
            )
        );
        
        require(success, "Verification call failed");
        isValid = abi.decode(data, (bool));
        
        // 记录验证结果
        verifiedProofs[proofHash] = true;
        verificationHistory[proofHash] = VerificationRecord({
            voteId: voteId,
            voter: msg.sender,
            timestamp: block.timestamp,
            isValid: isValid
        });
        
        emit ProofVerified(proofHash, voteId, msg.sender, isValid, block.timestamp);
        
        return isValid;
    }
    
    /**
     * 检查证明是否已验证
     * @param proofHash 证明哈希
     * @return verified 是否已验证
     */
    function isProofVerified(bytes32 proofHash) external view returns (bool verified) {
        return verifiedProofs[proofHash];
    }
    
    /**
     * 获取验证记录
     * @param proofHash 证明哈希
     * @return voteId 投票ID
     * @return voter 投票者地址
     * @return timestamp 验证时间戳
     * @return isValid 是否有效
     */
    function getVerificationRecord(bytes32 proofHash) external view returns (
        uint256 voteId,
        address voter,
        uint256 timestamp,
        bool isValid
    ) {
        VerificationRecord memory record = verificationHistory[proofHash];
        return (record.voteId, record.voter, record.timestamp, record.isValid);
    }
}
