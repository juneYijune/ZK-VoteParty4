# ZK 服务钱包地址哈希问题修复

## 问题描述

用户在进行投票资格验证时，遇到 404 错误：

```
POST http://localhost:3001/api/zk/generate-proof 404 (Not Found)
验证流程失败: Error: 您没有有效的可验证凭证，请先申请VC
```

但用户确认他们的 VC 是有效的，在"我的 VC"列表中可以看到，并且验证 VC 真伪也通过了。

## 问题原因

### 数据库表结构

在 `verifiable_credentials` 表中，`vc_holder_wallet_hash` 字段存储的是钱包地址的 **Poseidon 哈希值**，而不是原始钱包地址：

```sql
CREATE TABLE verifiable_credentials (
    ...
    vc_holder_wallet_hash CHAR(66) NOT NULL COMMENT '钱包地址哈希',
    ...
)
```

- **原始钱包地址**: `0x` + 40 个十六进制字符（20 字节）
  - 示例: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
  - 长度: 42 个字符

- **Poseidon 哈希值**: `0x` + 64 个十六进制字符（32 字节）
  - 示例: `0x1dd589dd3bad53f5930071b2575b519e87c5054933d55d617583fa7eaf0bdfe9`
  - 长度: 66 个字符

### 错误的查询逻辑

在 `backend/src/services/zk.service.js` 的 `generateProof` 函数中，直接使用原始钱包地址查询数据库：

```javascript
// ❌ 错误：直接使用原始钱包地址查询
var vcSql = 
  'SELECT vc_id, vc_content, vc_status, vc_holder_wallet_hash ' +
  'FROM verifiable_credentials ' +
  'WHERE vc_id = ? AND vc_holder_wallet_hash = ?';

var vcRes = await query(vcSql, [vid, walletAddress]);  // walletAddress 是原始地址
```

这会导致查询失败，因为：
- `walletAddress` = `0x742d35Cc...`（42 字符）
- `vc_holder_wallet_hash` = `0x1dd589dd...`（66 字符）
- 两者不匹配，查询返回空结果

### 为什么其他地方可以正常工作？

在 `backend/src/controllers/vc.controller.js` 的 `getMyValidVCs` 函数中，正确地使用了 Poseidon 哈希：

```javascript
// ✅ 正确：先计算哈希再查询
var walletHash = await partyUsersService.poseidonHashAddress(walletAddress);

var result = await vcService.listVCsByUser({
  holder_wallet_hash: walletHash,  // 使用哈希值查询
  vc_status: 1,
  page: 1,
  pageSize: 100
});
```

这就是为什么用户可以在"我的 VC"列表中看到 VC，但在 ZK 验证时却找不到。

## 解决方案

### 修复步骤

1. **导入 `poseidonHashAddress` 函数**

在 `backend/src/services/zk.service.js` 顶部添加导入：

```javascript
var { poseidonHashAddress } = require('./partyUsers.service');
```

2. **在查询前计算钱包地址哈希**

在 `generateProof` 函数中，先计算哈希再查询：

```javascript
// 2. 计算钱包地址的 Poseidon 哈希
console.log('[ZK Service] 计算钱包地址哈希...');
var walletHash = await poseidonHashAddress(walletAddress);
console.log('[ZK Service] 钱包地址:', walletAddress, '-> 哈希:', walletHash);

// 3. 获取VC内容
var vcSql = 
  'SELECT vc_id, vc_content, vc_status, vc_holder_wallet_hash ' +
  'FROM verifiable_credentials ' +
  'WHERE vc_id = ? AND vc_holder_wallet_hash = ?';

var vcRes = await query(vcSql, [vid, walletHash]);  // 使用哈希值查询
```

3. **更新注释编号**

由于添加了新的步骤，更新后续注释的编号（从 3 到 11）。

## Poseidon 哈希算法

### 为什么使用 Poseidon 哈希？

Poseidon 是一种零知识证明友好的哈希函数，专门为 ZK-SNARK 电路设计：

1. **电路效率**: 在 ZK 电路中计算 Poseidon 哈希比 Keccak256 或 SHA256 更高效
2. **约束数量少**: 需要更少的约束（constraints），使证明生成更快
3. **ZK 友好**: 专门为零知识证明系统优化

### Poseidon 哈希实现

在 `backend/src/services/partyUsers.service.js` 中：

```javascript
async function poseidonHashAddress(address) {
  try {
    var poseidon = await initPoseidon();
    
    // 移除 0x 前缀
    var cleanAddress = address.toLowerCase().replace("0x", "");
    
    // 将地址分成两部分
    // 以太坊地址是40个十六进制字符（20字节）
    var part1 = BigInt("0x" + cleanAddress.slice(0, 32)); // 前16字节
    var part2 = BigInt("0x" + cleanAddress.slice(32));     // 后4字节
    
    // 使用 Poseidon hash
    var hash = poseidon([part1, part2]);
    
    // 转换为十六进制字符串
    var hashHex = poseidon.F.toString(hash, 16);
    
    // 补齐到64位（32字节）
    return "0x" + hashHex.padStart(64, "0");
  } catch (e) {
    console.error("Poseidon hash error:", e);
    // 如果 Poseidon 失败，使用明文地址
    return address;
  }
}
```

### 哈希过程

1. **输入**: 以太坊地址 `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
2. **移除前缀**: `742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
3. **分割**:
   - Part 1: `742d35Cc6634C0532925a3b844Bc9e75` (前 32 字符)
   - Part 2: `95f0bEb` (后 8 字符)
4. **转换为 BigInt**:
   - Part 1: `BigInt("0x742d35Cc6634C0532925a3b844Bc9e75")`
   - Part 2: `BigInt("0x95f0bEb")`
5. **Poseidon 哈希**: `poseidon([part1, part2])`
6. **输出**: `0x1dd589dd3bad53f5930071b2575b519e87c5054933d55d617583fa7eaf0bdfe9`

## 修改的文件

1. **backend/src/services/zk.service.js**
   - 导入 `poseidonHashAddress` 函数
   - 在查询 VC 前计算钱包地址哈希
   - 使用哈希值而不是原始地址查询数据库
   - 更新注释编号

## 测试验证

### 测试场景 1: 正常验证流程

**步骤**:
1. 用户登录系统
2. 查看"我的 VC"列表，确认有有效的 VC
3. 进入投票列表
4. 点击某个投票
5. 在验证对话框中选择 VC
6. 点击"开始验证"

**预期结果**:
- ✅ 后端成功找到 VC
- ✅ 证明生成成功
- ✅ 验证流程完成

### 测试场景 2: 日志输出

**后端日志应该显示**:
```
[ZK Service] 计算钱包地址哈希...
[ZK Service] 钱包地址: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb -> 哈希: 0x1dd589dd3bad53f5930071b2575b519e87c5054933d55d617583fa7eaf0bdfe9
[ZK Service] 开始生成证明...
[ZK Service] 证明生成完成，耗时: X秒
```

### 测试场景 3: 数据库查询

**SQL 查询**:
```sql
SELECT vc_id, vc_content, vc_status, vc_holder_wallet_hash 
FROM verifiable_credentials 
WHERE vc_id = 1 
  AND vc_holder_wallet_hash = '0x1dd589dd3bad53f5930071b2575b519e87c5054933d55d617583fa7eaf0bdfe9';
```

**预期结果**: 返回匹配的 VC 记录

## 相关问题预防

### 问题 1: 其他服务也使用钱包地址查询

**检查点**: 确保所有需要查询 `vc_holder_wallet_hash` 的地方都使用哈希值

**已正确实现的地方**:
- ✅ `vc.controller.js` 的 `getMyValidVCs`
- ✅ `vc.service.js` 的 `listVCsByUser`

**需要注意的地方**:
- ✅ `zk.service.js` 的 `generateProof`（已修复）

### 问题 2: 前端传递的是原始地址

**说明**: 前端始终传递原始钱包地址（42 字符），后端负责计算哈希。这是正确的设计，因为：

1. **前端不需要知道哈希算法**: 保持前端简单
2. **后端统一处理**: 所有哈希计算在后端进行
3. **安全性**: 哈希算法可以在后端更改，不影响前端

### 问题 3: 数据库中的地址格式

**当前设计**:
- `party_users.wallet_address`: 存储原始地址（42 字符）
- `party_users.wallet_address_hash`: 存储 Poseidon 哈希（66 字符）
- `verifiable_credentials.vc_holder_wallet_hash`: 存储 Poseidon 哈希（66 字符）

**为什么这样设计**:
1. **原始地址**: 用于显示和日志
2. **哈希值**: 用于数据库查询和 ZK 电路

## 总结

这个问题的核心是**数据类型不匹配**：

- ❌ **错误**: 使用原始钱包地址（42 字符）查询哈希字段（66 字符）
- ✅ **正确**: 先计算 Poseidon 哈希，再查询数据库

修复后，ZK 验证流程可以正确找到用户的 VC，并成功生成和验证零知识证明。

## 相关文档

- [ZK 服务实现](./ZK_API_IMPLEMENTATION.md)
- [VC 服务实现](../VC_ISSUANCE_FEATURE.md)
- [Poseidon 哈希说明](./scripts/test-poseidon-hash.js)
- [钱包地址验证修复](../frontend/WALLET_ADDRESS_FIX.md)
