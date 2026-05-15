# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js
```


项目编译

每次合约改动后执行：npm run compile; npm run export:abi:frontend

1.启动本地区块链（Hardhat node）：npm run node 
2.部署合约到 localhost 网络（给 MetaMask/前端用）：npm run deploy:localhost 会输出合约地址（例如 0x...），把它复制下来和Deployer
cd contracts
# 部署主合约
npx hardhat run scripts/deploy.js --network localhost
# 部署验证器合约
npx hardhat run scripts/deploy-verifier-simple.js --network localhost
```
3.导出 PartyVotingABI 到前端：npm run export:abi:frontend  这会生成/更新：
frontend/contracts/PartyVoting.abi.js
4.配置前端环境变量（写合约地址 + 后端地址）

  npx hardhat compile
  npx hardhat run scripts/deploy-verifier-simple.js --network localhost
  导出导出验证器合约 ABI（如果部署了验证器）
  $artifact = Get-Content "artifacts/contracts/VotingEligibilityVerifier.sol/VotingEligibilityVerifier.json" | ConvertFrom-Json
  $abi = $artifact.abi | ConvertTo-Json -Depth 10
  "export default $abi;" | Out-File -FilePath "../frontend/contracts/VotingEligibilityVerifier.abi.js" -Encoding utf8

Write-Host "ABI 已更新"
查看帮助
node scripts/export-all-abis.js --help

导出所有合约（默认）
cd contracts
npm run export:abi
# 或
node scripts/export-all-abis.js
cd contracts

# 只导出 PartyVoting
npm run export:abi PartyVoting
# 或
node scripts/export-all-abis.js PartyVoting

# 只导出 VotingEligibilityVerifier
npm run export:abi VotingEligibilityVerifier
# 或
node scripts/export-all-abis.js VotingEligibilityVerifier


# 智能合约更新指南

当你修改了智能合约代码后，需要按照以下步骤重新部署和更新配置。

## 📋 更新流程总览

```
修改合约 → 编译 → 部署 → 导出ABI → 更新配置 → 重启服务
```

---

## 🔧 详细步骤

### 步骤 1: 编译合约

修改合约后，首先需要重新编译：

```bash
cd contracts
npx hardhat compile
```

**检查编译结果：**
- ✅ 成功：`Compiled X Solidity files successfully`
- ❌ 失败：检查语法错误并修复

---

### 步骤 2: 重新部署合约

#### 2.1 确保 Hardhat 节点正在运行

```bash
# 如果没有运行，启动它
cd contracts
npx hardhat node
```

**注意：** 如果重启了 Hardhat 节点，所有之前的合约都会丢失，需要全部重新部署。

#### 2.2 部署主合约（PartyVoting）

```bash
# 在新终端中
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

**输出示例：**
```
PartyVoting deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Admin address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

**记录合约地址！** 你需要在后续步骤中使用它。

#### 2.3 部署验证器合约（如果修改了 VotingEligibilityVerifier）

```bash
cd contracts
npx hardhat run scripts/deploy-verifier-simple.js --network localhost
```

**输出示例：**
```
ZK 验证器 (Groth16Verifier): 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
投票资格验证器 (VotingEligibilityVerifier): 0x0165878A594ca255338adfa4d48449f69242Eb8F
```

---

### 步骤 3: 导出 ABI 到前端

#### 3.1 导出主合约 ABI

```bash
cd contracts
npx hardhat run scripts/export-frontend-abi.js --network localhost
```

这会自动将 ABI 导出到 `frontend/contracts/PartyVoting.abi.js`

#### 3.2 导出验证器合约 ABI（如果部署了验证器）

```bash
cd contracts

# PowerShell
$artifact = Get-Content "artifacts/contracts/VotingEligibilityVerifier.sol/VotingEligibilityVerifier.json" | ConvertFrom-Json
$abi = $artifact.abi | ConvertTo-Json -Depth 10
"export default $abi;" | Out-File -FilePath "../frontend/contracts/VotingEligibilityVerifier.abi.js" -Encoding utf8
```

---

### 步骤 4: 更新前端配置

编辑 `frontend/.env.local`，更新合约地址：

```env
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_PARTY_VOTING_ADDRESS=<新的主合约地址>
NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS=<新的验证器合约地址>
```

**示例：**
```env
NEXT_PUBLIC_PARTY_VOTING_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS=0x0165878A594ca255338adfa4d48449f69242Eb8F
```

---

### 步骤 5: 更新合约配置文件（可选但推荐）

#### 5.1 更新主合约配置

编辑 `frontend/contracts/partyVoting.js`：

```javascript
import PartyVotingAbi from "./PartyVoting.abi";
import { getFrontendEnv } from "@/lib/env";

export const PartyVotingContract = {
  address: "<新的主合约地址>", // 或者使用环境变量
  abi: PartyVotingAbi
};
```

#### 5.2 更新验证器合约配置

编辑 `frontend/contracts/votingEligibilityVerifier.js`：

```javascript
import VotingEligibilityVerifierAbi from "./VotingEligibilityVerifier.abi";

export const VotingEligibilityVerifierContract = {
  address: "<新的验证器合约地址>",
  abi: VotingEligibilityVerifierAbi
};
```

---

### 步骤 6: 重启前端服务

```bash
# 在前端终端按 Ctrl+C 停止服务
# 然后重新启动
cd frontend
npm run dev
```

---

### 步骤 7: 重置 MetaMask（重要！）

如果重启了 Hardhat 节点或重新部署了合约，**必须重置 MetaMask**：

1. 打开 MetaMask
2. 点击右上角头像 → 设置
3. 高级 → 重置账户
4. 确认重置

**为什么要重置？**
- Hardhat 节点重启后，nonce（交易计数）会重置
- 不重置会导致交易失败（nonce 不匹配）

---

## 🚀 快速更新脚本

创建 `update-contract.bat` 批处理文件：

```batch
@echo off
chcp 65001 >nul
echo ========================================
echo 智能合约更新流程
echo ========================================
echo.

echo [1/5] 编译合约...
cd contracts
call npx hardhat compile
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 编译失败，请检查错误
    pause
    exit /b 1
)
echo ✓ 编译成功
echo.

echo [2/5] 部署主合约...
call npx hardhat run scripts/deploy.js --network localhost
echo ✓ 主合约已部署
echo.

echo [3/5] 部署验证器合约...
call npx hardhat run scripts/deploy-verifier-simple.js --network localhost
echo ✓ 验证器合约已部署
echo.

echo [4/5] 导出 ABI...
call npx hardhat run scripts/export-frontend-abi.js --network localhost
echo ✓ ABI 已导出
echo.

echo [5/5] 完成！
echo.
echo ========================================
echo 下一步操作：
echo ========================================
echo 1. 更新 frontend/.env.local 中的合约地址
echo 2. 重启前端服务 (Ctrl+C 然后 npm run dev)
echo 3. 重置 MetaMask 账户
echo ========================================
echo.
pause
```

---

## 📝 常见场景

### 场景 1: 只修改了主合约（PartyVoting）

```bash
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/export-frontend-abi.js --network localhost

# 更新 frontend/.env.local 中的 NEXT_PUBLIC_PARTY_VOTING_ADDRESS
# 重启前端服务
```

### 场景 2: 只修改了验证器合约

```bash
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy-verifier-simple.js --network localhost

# 导出 ABI（手动或使用脚本）
# 更新 frontend/.env.local 中的 NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS
# 重启前端服务
```

### 场景 3: 修改了 ZK 电路

```bash
# 1. 重新编译电路
cd ZKcircuits
scripts\compile.bat

# 2. 重新设置
scripts\setup.bat

# 3. 生成新的验证器合约
scripts\generate-verifier.bat

# 4. 部署新的验证器合约
cd ..\contracts
npx hardhat compile
npx hardhat run scripts/deploy-verifier-simple.js --network localhost

# 5. 更新配置并重启前端
```

### 场景 4: Hardhat 节点重启了

**所有合约都需要重新部署！**

```bash
# 1. 部署主合约
cd contracts
npx hardhat run scripts/deploy.js --network localhost

# 2. 部署验证器合约
npx hardhat run scripts/deploy-verifier-simple.js --network localhost

# 3. 导出 ABI
npx hardhat run scripts/export-frontend-abi.js --network localhost

# 4. 更新所有合约地址
# 编辑 frontend/.env.local

# 5. 重启前端服务

# 6. 重置 MetaMask
```

---

## ⚠️ 注意事项

### 1. 数据丢失
- Hardhat 节点重启后，所有链上数据都会丢失
- 包括：投票记录、VC、验证记录等
- 数据库中的数据不会丢失，但合约地址会变化

### 2. 合约地址变化
- 每次部署，合约地址都会改变
- 必须更新前端配置
- 必须重置 MetaMask

### 3. ABI 同步
- 修改合约后，ABI 会改变
- 必须重新导出 ABI 到前端
- 否则前端调用会失败

### 4. 测试账户
- Hardhat 节点重启后，测试账户地址不变
- 但余额会重置为 10000 ETH
- nonce 会重置为 0

---

## 🔍 验证更新是否成功

### 1. 检查合约地址

在浏览器控制台：
```javascript
console.log(process.env.NEXT_PUBLIC_PARTY_VOTING_ADDRESS)
console.log(process.env.NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS)
```

### 2. 测试合约调用

尝试调用一个简单的合约方法，如获取管理员地址：
```javascript
// 在前端代码中
const admin = await contract.getAdmin();
console.log('Admin:', admin);
```

### 3. 检查 MetaMask

- 确保连接到 Localhost 8545
- 确保账户有余额
- 尝试发送一笔测试交易

---

## 📚 相关文档

- [UPDATE_CONTRACT_STEPS.md](./UPDATE_CONTRACT_STEPS.md) - 原有的更新步骤
- [START_PROJECT.md](./START_PROJECT.md) - 项目启动指南
- [ONCHAIN_VERIFICATION_GUIDE.md](./ONCHAIN_VERIFICATION_GUIDE.md) - 链上验证指南

---

## 🆘 故障排除

### 问题 1: 合约调用失败

**错误：** `Error: call revert exception`

**解决：**
1. 检查合约地址是否正确
2. 检查 ABI 是否最新
3. 重启前端服务
4. 重置 MetaMask

### 问题 2: 交易 nonce 错误

**错误：** `Error: nonce has already been used`

**解决：**
1. 重置 MetaMask 账户
2. 刷新页面

### 问题 3: 找不到合约

**错误：** `Error: contract not deployed`

**解决：**
1. 确认 Hardhat 节点正在运行
2. 重新部署合约
3. 检查网络配置（Chain ID: 31337）

---

希望这个指南能帮助你顺利更新智能合约！🎉
