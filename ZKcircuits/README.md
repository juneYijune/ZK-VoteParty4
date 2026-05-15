# 零知识证明投票资格验证电路

本目录包含用于零知识证明投票资格验证的Circom电路及相关工具。

## 目录结构

```
ZKcircuits/
├── circuits/
│   └── eligibleVoter.circom          # 电路源文件
├── build/                             # 编译输出（自动生成）
│   ├── eligibleVoter.r1cs            # 约束系统
│   ├── eligibleVoter_js/
│   │   ├── eligibleVoter.wasm        # WebAssembly见证生成器
│   │   └── witness_calculator.js     # 见证计算器
│   ├── eligibleVoter_0000.zkey       # 初始zkey
│   └── eligibleVoter_final.zkey      # 最终proving key
├── keys/                              # 密钥文件（自动生成）
│   ├── powersOfTau28_hez_final_10.ptau  # 可信设置参数
│   └── verification_key.json         # Verification key
├── contracts/                         # Solidity合约（可选）
│   └── EligibleVoterVerifier.sol     # 验证器合约
├── scripts/
│   ├── compile.sh                    # 编译脚本
│   ├── setup.sh                      # 密钥生成脚本
│   └── generate-verifier.sh          # 验证器生成脚本
├── package.json                       # 依赖管理
└── README.md                          # 本文件
```

## 前置要求

在开始之前，请确保已安装以下工具：

1. **Node.js** (v16或更高版本)
   ```bash
   node --version
   ```

2. **Circom** (v2.0或更高版本)
   ```bash
   circom --version
   ```
   
   安装Circom：
   ```bash
   # 方法1: 使用cargo安装（推荐）
   cargo install circom
   
   # 方法2: 从源码编译
   git clone https://github.com/iden3/circom.git
   cd circom
   cargo build --release
   cargo install --path circom
   ```

3. **snarkjs** (通过npm安装)
   ```bash
   npm install -g snarkjs
   ```

## 快速开始

### 1. 安装依赖

```bash
cd ZKcircuits
npm install
```

### 2. 编译电路

编译eligibleVoter.circom电路，生成R1CS约束系统和WASM见证生成器：

```bash
npm run compile
```

**输出文件**：
- `build/eligibleVoter.r1cs` - 约束系统文件
- `build/eligibleVoter_js/eligibleVoter.wasm` - WebAssembly见证生成器
- `build/eligibleVoter.sym` - 符号文件
- `build/eligibleVoter.r1cs.json` - R1CS的JSON表示（用于调试）

### 3. 生成密钥

生成proving key和verification key：

```bash
npm run setup
```

**输出文件**：
- `keys/powersOfTau28_hez_final_10.ptau` - Powers of Tau可信设置参数（约8MB）
- `build/eligibleVoter_0000.zkey` - 初始zkey
- `build/eligibleVoter_final.zkey` - 最终proving key
- `keys/verification_key.json` - Verification key

**注意**：首次运行时会自动下载Powers of Tau参数文件（约8MB），请确保网络连接正常。

### 4. 生成Solidity验证器（可选）

如果需要在区块链上进行链上验证，可以生成Solidity验证器合约：

```bash
npm run generate-verifier
```

**输出文件**：
- `contracts/EligibleVoterVerifier.sol` - Solidity验证器合约

## 电路说明

### eligibleVoter.circom

此电路用于验证投票者是否满足投票资格要求，同时保护用户的隐私信息。

#### 私有输入（用户VC内容）

这些输入对验证者保密，不会被泄露：

- `is_formal_member` (0或1): 是否正式党员
- `is_active` (0或1): 是否active状态
- `fee_paid` (0或1): 是否缴纳党费
- `no_conflict` (0或1): 是否无冲突
- `voter_party_years` (整数): 党龄（年）
- `voter_org_code` (整数): 党组织编码（数字部分）

#### 公共输入（投票资格规则）

这些输入对所有人公开：

- `require_formal_member` (0或1): 是否要求正式党员
- `require_active` (0或1): 是否要求active状态
- `require_fee_paid` (0或1): 是否要求缴纳党费
- `require_no_conflict` (0或1): 是否要求无冲突
- `require_party_years` (0或1): 是否要求党龄
- `min_party_years` (整数): 最小党龄要求
- `require_org_code` (0或1): 是否要求特定组织
- `required_org_code` (整数): 要求的组织编码

#### 输出

- `is_eligible` (0或1): 是否符合资格

#### 验证逻辑

电路验证以下条件（所有条件必须同时满足）：

```
is_eligible = 1 当且仅当:
  (!require_formal_member || is_formal_member) &&
  (!require_active || is_active) &&
  (!require_fee_paid || fee_paid) &&
  (!require_no_conflict || no_conflict) &&
  (!require_party_years || voter_party_years >= min_party_years) &&
  (!require_org_code || voter_org_code == required_org_code)
```

## 使用示例

### 在后端使用（Node.js）

```javascript
const snarkjs = require('snarkjs');
const fs = require('fs');

// 1. 准备输入
const input = {
  // 私有输入（用户VC内容）
  is_formal_member: 1,
  is_active: 1,
  fee_paid: 1,
  no_conflict: 1,
  voter_party_years: 5,
  voter_org_code: 1,
  
  // 公共输入（投票资格规则）
  require_formal_member: 1,
  require_active: 1,
  require_fee_paid: 1,
  require_no_conflict: 1,
  require_party_years: 1,
  min_party_years: 3,
  require_org_code: 0,
  required_org_code: 0
};

// 2. 生成证明
async function generateProof() {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'ZKcircuits/build/eligibleVoter_js/eligibleVoter.wasm',
    'ZKcircuits/build/eligibleVoter_final.zkey'
  );
  
  console.log('Proof:', proof);
  console.log('Public Signals:', publicSignals);
  
  return { proof, publicSignals };
}

// 3. 验证证明
async function verifyProof(proof, publicSignals) {
  const vKey = JSON.parse(
    fs.readFileSync('ZKcircuits/keys/verification_key.json')
  );
  
  const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  
  console.log('Verification result:', isValid);
  
  return isValid;
}

// 执行
(async () => {
  const { proof, publicSignals } = await generateProof();
  const isValid = await verifyProof(proof, publicSignals);
  
  if (isValid) {
    console.log('✓ 证明验证成功！');
    console.log('用户符合资格:', publicSignals[publicSignals.length - 1] === '1');
  } else {
    console.log('✗ 证明验证失败！');
  }
})();
```

## 数据映射

### VC内容 → 电路私有输入

```javascript
function mapVCToPrivateInputs(vcContent) {
  return {
    is_formal_member: vcContent.isFormalPartyMember ? 1 : 0,
    is_active: vcContent.partyStatus === 1 ? 1 : 0,
    fee_paid: vcContent.paidPartyFee ? 1 : 0,
    no_conflict: vcContent.conflictFree ? 1 : 0,
    voter_party_years: vcContent.partyYears,
    voter_org_code: parseInt(vcContent.partyOrgCode.replace(/\D/g, ''))
  };
}
```

### 资格规则 → 电路公共输入

```javascript
function mapRuleToPublicInputs(eligibilityRule) {
  return {
    require_formal_member: eligibilityRule.require_formal_member ? 1 : 0,
    require_active: eligibilityRule.require_active_status ? 1 : 0,
    require_fee_paid: eligibilityRule.require_fee_paid ? 1 : 0,
    require_no_conflict: eligibilityRule.require_no_conflict ? 1 : 0,
    require_party_years: eligibilityRule.min_party_years > 0 ? 1 : 0,
    min_party_years: eligibilityRule.min_party_years || 0,
    require_org_code: eligibilityRule.require_org_code ? 1 : 0,
    required_org_code: eligibilityRule.require_org_code 
      ? parseInt(eligibilityRule.require_org_code) 
      : 0
  };
}
```

## 性能指标

- **电路约束数量**: 约1000-2000个约束（取决于具体实现）
- **证明生成时间**: < 10秒（目标）
- **证明验证时间**: < 2秒（目标）
- **证明大小**: 约200-300字节

## 安全注意事项

1. **可信设置**: 本项目使用Hermez的Powers of Tau可信设置参数。在生产环境中，建议使用多方计算（MPC）生成自己的可信设置。

2. **密钥管理**: 
   - `eligibleVoter_final.zkey` (proving key) 应该部署到后端服务器
   - `verification_key.json` 可以公开
   - 不要泄露中间的zkey文件

3. **输入验证**: 在生成证明前，务必验证所有输入的有效性和范围。

4. **隐私保护**: 私有输入（用户VC内容）不应该记录到日志中。

## 故障排除

### 问题1: circom命令未找到

**解决方案**: 确保已正确安装Circom并添加到PATH：

```bash
# 检查Circom是否安装
which circom

# 如果未安装，使用cargo安装
cargo install circom
```

### 问题2: Powers of Tau下载失败

**解决方案**: 手动下载文件：

```bash
cd keys
curl -o powersOfTau28_hez_final_10.ptau https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
```

### 问题3: 编译时内存不足

**解决方案**: 增加Node.js内存限制：

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run compile
```

### 问题4: Windows系统无法运行bash脚本

**解决方案**: 使用Git Bash或WSL，或者手动执行脚本中的命令。

## 参考资料

- [Circom官方文档](https://docs.circom.io/)
- [snarkjs文档](https://github.com/iden3/snarkjs)
- [ZK-SNARK入门](https://z.cash/technology/zksnarks/)
- [Groth16协议](https://eprint.iacr.org/2016/260.pdf)

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系项目维护者。
