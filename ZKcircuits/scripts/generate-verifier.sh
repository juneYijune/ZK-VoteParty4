#!/bin/bash

# generate-verifier.sh
# 生成Solidity验证器合约（可选）
# 
# 此脚本将：
# 1. 从zkey文件生成Solidity验证器合约
# 2. 将合约保存到contracts目录
#
# 输出文件：
# - contracts/EligibleVoterVerifier.sol: Solidity验证器合约
#
# 注意：此步骤是可选的，仅在需要链上验证时使用

set -e

echo "=========================================="
echo "生成Solidity验证器合约"
echo "=========================================="

# 创建contracts目录
mkdir -p contracts

# 检查zkey文件是否存在
if [ ! -f "build/eligibleVoter_final.zkey" ]; then
    echo "✗ 错误: build/eligibleVoter_final.zkey 不存在"
    echo "请先运行 'npm run setup' 生成密钥"
    exit 1
fi

# 生成Solidity验证器
echo ""
echo "步骤 1/1: 生成Solidity验证器合约..."
snarkjs zkey export solidityverifier build/eligibleVoter_final.zkey contracts/EligibleVoterVerifier.sol
echo "✓ Solidity验证器生成成功: contracts/EligibleVoterVerifier.sol"

# 显示合约信息
echo ""
echo "合约信息："
echo "  - 文件: contracts/EligibleVoterVerifier.sol"
echo "  - 合约名: Groth16Verifier"
echo "  - 主要函数: verifyProof()"
echo ""

echo "=========================================="
echo "Solidity验证器生成完成！"
echo "=========================================="
echo ""
echo "您可以将此合约部署到区块链上进行链上验证。"
echo "合约文件: contracts/EligibleVoterVerifier.sol"
echo ""
