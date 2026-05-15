# ZK电路设置完成

## 已创建的文件和目录

### 目录结构
```
ZKcircuits/
├── circuits/
│   └── eligibleVoter.circom          ✓ 电路源文件
├── scripts/
│   ├── compile.sh                    ✓ Linux/Mac编译脚本
│   ├── compile.bat                   ✓ Windows编译脚本
│   ├── setup.sh                      ✓ Linux/Mac密钥生成脚本
│   ├── setup.bat                     ✓ Windows密钥生成脚本
│   ├── generate-verifier.sh          ✓ Solidity验证器生成脚本
│   └── test-circuit.sh               ✓ 电路测试脚本
├── test/
│   ├── input.json                    ✓ 测试输入（满足资格）
│   └── input-not-eligible.json       ✓ 测试输入（不满足资格）
├── .gitignore                        ✓ Git忽略文件
├── package.json                      ✓ NPM配置文件
├── README.md                         ✓ 主文档
├── WINDOWS_SETUP.md                  ✓ Windows设置指南
└── SETUP_COMPLETE.md                 ✓ 本文件
```

### 待生成的文件（运行脚本后）
```
ZKcircuits/
├── build/                            (运行compile后生成)
│   ├── eligibleVoter.r1cs
│   ├── eligibleVoter_js/
│   │   ├── eligibleVoter.wasm
│   │   └── witness_calculator.js
│   ├── eligibleVoter_0000.zkey
│   └── eligibleVoter_final.zkey
├── keys/                             (运行setup后生成)
│   ├── powersOfTau28_hez_final_10.ptau
│   └── verification_key.json
└── contracts/                        (运行generate-verifier后生成)
    └── EligibleVoterVerifier.sol
```

## 下一步操作

### 1. 安装依赖

```bash
cd ZKcircuits
npm install
```

这将安装：
- circomlib: Circom标准库
- snarkjs: ZK-SNARK工具
- circom_tester: 电路测试工具

### 2. 编译电路

**Linux/Mac/Git Bash:**
```bash
npm run compile
```

**Windows命令提示符:**
```cmd
scripts\compile.bat
```

预期输出：
- build/eligibleVoter.r1cs
- build/eligibleVoter_js/eligibleVoter.wasm
- build/eligibleVoter.sym
- build/eligibleVoter.r1cs.json

### 3. 生成密钥

**Linux/Mac/Git Bash:**
```bash
npm run setup
```

**Windows命令提示符:**
```cmd
scripts\setup.bat
```

预期输出：
- keys/powersOfTau28_hez_final_10.ptau (约8MB，首次运行时下载)
- build/eligibleVoter_0000.zkey
- build/eligibleVoter_final.zkey
- keys/verification_key.json

### 4. 测试电路（可选）

**Linux/Mac/Git Bash:**
```bash
bash scripts/test-circuit.sh
```

这将运行两个测试用例：
1. 用户满足所有资格要求 → is_eligible = 1
2. 用户不满足党龄要求 → is_eligible = 0

## 电路说明

### eligibleVoter.circom

此电路验证投票者是否满足投票资格要求。

**私有输入（保密）:**
- is_formal_member: 是否正式党员 (0/1)
- is_active: 是否active状态 (0/1)
- fee_paid: 是否缴纳党费 (0/1)
- no_conflict: 是否无冲突 (0/1)
- voter_party_years: 党龄（年）
- voter_org_code: 党组织编码（数字）

**公共输入（公开）:**
- require_formal_member: 是否要求正式党员 (0/1)
- require_active: 是否要求active状态 (0/1)
- require_fee_paid: 是否要求缴纳党费 (0/1)
- require_no_conflict: 是否要求无冲突 (0/1)
- require_party_years: 是否要求党龄 (0/1)
- min_party_years: 最小党龄要求
- require_org_code: 是否要求特定组织 (0/1)
- required_org_code: 要求的组织编码

**输出:**
- is_eligible: 是否符合资格 (0/1)

## 集成到后端

编译和密钥生成完成后，需要将以下文件集成到后端：

### 复制到后端的文件

```bash
# 复制WASM文件和见证生成器
cp -r build/eligibleVoter_js ../backend/zk/

# 复制proving key
cp build/eligibleVoter_final.zkey ../backend/zk/

# 复制verification key
cp keys/verification_key.json ../backend/zk/
```

### 后端使用示例

```javascript
const snarkjs = require('snarkjs');
const fs = require('fs');

// 生成证明
async function generateProof(input) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'zk/eligibleVoter_js/eligibleVoter.wasm',
    'zk/eligibleVoter_final.zkey'
  );
  return { proof, publicSignals };
}

// 验证证明
async function verifyProof(proof, publicSignals) {
  const vKey = JSON.parse(fs.readFileSync('zk/verification_key.json'));
  const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  return isValid;
}
```

## 验证清单

- [ ] 已安装Node.js (v16+)
- [ ] 已安装Circom (v2.0+)
- [ ] 已安装snarkjs
- [ ] 已运行 `npm install`
- [ ] 已运行 `npm run compile`
- [ ] 已运行 `npm run setup`
- [ ] 已测试电路（可选）
- [ ] 已将文件复制到后端（如需要）

## 故障排除

### Circom未安装

**Linux/Mac:**
```bash
cargo install circom
```

**Windows:**
从 https://github.com/iden3/circom/releases 下载预编译版本

### Powers of Tau下载失败

手动下载：
```bash
cd keys
curl -o powersOfTau28_hez_final_10.ptau https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
```

### 内存不足

增加Node.js内存：
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run compile
```

## 参考文档

- README.md: 完整使用文档
- WINDOWS_SETUP.md: Windows系统设置指南
- circuits/eligibleVoter.circom: 电路源码（包含详细注释）

## 任务完成状态

✓ 任务1: ZK电路编译和部署 - 已完成

已完成的子任务：
- ✓ 设置ZKcircuits目录结构
- ✓ 编写编译和密钥生成脚本
- ✓ 创建电路源文件
- ✓ 创建测试输入文件
- ✓ 创建文档

下一步：运行编译和密钥生成脚本以生成必要的电路文件和密钥。
