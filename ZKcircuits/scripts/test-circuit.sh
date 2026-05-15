#!/bin/bash

# test-circuit.sh
# 测试电路功能
# 
# 此脚本将：
# 1. 使用测试输入生成见证
# 2. 生成证明
# 3. 验证证明
#
# 前提条件：
# - 已运行 compile.sh 编译电路
# - 已运行 setup.sh 生成密钥

set -e

echo "=========================================="
echo "测试零知识证明电路"
echo "=========================================="

# 检查必要文件是否存在
if [ ! -f "build/eligibleVoter_js/eligibleVoter.wasm" ]; then
    echo "✗ 错误: WASM文件不存在"
    echo "请先运行 'npm run compile' 编译电路"
    exit 1
fi

if [ ! -f "build/eligibleVoter_final.zkey" ]; then
    echo "✗ 错误: zkey文件不存在"
    echo "请先运行 'npm run setup' 生成密钥"
    exit 1
fi

# 创建临时目录
mkdir -p test/output

# 测试1: 用户满足资格
echo ""
echo "测试 1/2: 用户满足所有资格要求"
echo "----------------------------------------"

# 生成见证
echo "生成见证..."
node build/eligibleVoter_js/generate_witness.js \
    build/eligibleVoter_js/eligibleVoter.wasm \
    test/input.json \
    test/output/witness1.wtns

# 生成证明
echo "生成证明..."
snarkjs groth16 prove \
    build/eligibleVoter_final.zkey \
    test/output/witness1.wtns \
    test/output/proof1.json \
    test/output/public1.json

# 验证证明
echo "验证证明..."
snarkjs groth16 verify \
    keys/verification_key.json \
    test/output/public1.json \
    test/output/proof1.json

echo ""
echo "公共输出 (public signals):"
cat test/output/public1.json
echo ""

# 测试2: 用户不满足资格
echo ""
echo "测试 2/2: 用户不满足党龄要求"
echo "----------------------------------------"

# 生成见证
echo "生成见证..."
node build/eligibleVoter_js/generate_witness.js \
    build/eligibleVoter_js/eligibleVoter.wasm \
    test/input-not-eligible.json \
    test/output/witness2.wtns

# 生成证明
echo "生成证明..."
snarkjs groth16 prove \
    build/eligibleVoter_final.zkey \
    test/output/witness2.wtns \
    test/output/proof2.json \
    test/output/public2.json

# 验证证明
echo "验证证明..."
snarkjs groth16 verify \
    keys/verification_key.json \
    test/output/public2.json \
    test/output/proof2.json

echo ""
echo "公共输出 (public signals):"
cat test/output/public2.json
echo ""

echo "=========================================="
echo "电路测试完成！"
echo "=========================================="
echo ""
echo "测试结果文件："
echo "  - test/output/witness1.wtns, witness2.wtns"
echo "  - test/output/proof1.json, proof2.json"
echo "  - test/output/public1.json, public2.json"
echo ""
