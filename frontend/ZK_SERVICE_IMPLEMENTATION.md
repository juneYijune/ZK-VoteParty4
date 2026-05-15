# 前端ZK API服务实现文档

## 概述

本文档描述了前端ZK API服务的实现，该服务提供了与后端ZK API交互的接口，用于生成和验证零知识证明。

## 实现文件

- **主文件**: `frontend/services/zk.js`
- **导出**: 已添加到 `frontend/services/index.js`

## 功能实现

### 1. generateProof(vcId, voteId, walletAddress)

生成零知识证明的API调用函数。

**参数**:
- `vcId` (number): 可验证凭证ID
- `voteId` (number): 投票ID
- `walletAddress` (string): 钱包地址

**返回值**:
```javascript
{
  proof: {
    pi_a: [...],
    pi_b: [...],
    pi_c: [...],
    protocol: "groth16",
    curve: "bn128"
  },
  publicSignals: ["1", "1", "1", "1", "1", "5", "0", "0"]
}
```

**错误处理**:
- 参数验证失败: 抛出明确的错误信息
- API调用失败: 返回用户友好的错误信息
- 网络错误: 提示检查网络连接

### 2. verifyProof(proof, publicSignals, voteId)

验证零知识证明的API调用函数。

**参数**:
- `proof` (object): 证明对象
- `publicSignals` (array): 公共信号数组
- `voteId` (number): 投票ID

**返回值**:
```javascript
{
  isValid: true,
  isEligible: true
}
```

**错误处理**:
- 参数验证失败: 抛出明确的错误信息
- API调用失败: 返回用户友好的错误信息
- 网络错误: 提示检查网络连接

## 安全特性

### HTTPS协议强制

实现了 `ensureHttps()` 函数，确保所有API调用使用HTTPS协议：

```javascript
function ensureHttps(url) {
  if (!url.startsWith("https://") && !url.startsWith("http://localhost")) {
    throw new Error("必须使用HTTPS协议进行安全传输");
  }
}
```

**例外情况**:
- 允许 `http://localhost` 用于本地开发
- 生产环境必须使用HTTPS

### 参数验证

所有函数都包含严格的参数验证：
- 类型检查
- 空值检查
- 格式验证

### 错误信息

提供用户友好的错误信息：
- "证明生成失败，请重试或联系管理员"
- "证明验证失败，请重试"
- "网络错误，请检查网络连接后重试"
- "必须使用HTTPS协议进行安全传输"

## 使用示例

### 生成证明

```javascript
import { generateProof } from '@/services/zk';

try {
  const result = await generateProof(123, 456, "0x1234...");
  console.log("证明生成成功:", result.proof);
  console.log("公共信号:", result.publicSignals);
} catch (error) {
  console.error("证明生成失败:", error.message);
}
```

### 验证证明

```javascript
import { verifyProof } from '@/services/zk';

try {
  const result = await verifyProof(proof, publicSignals, 456);
  if (result.isValid && result.isEligible) {
    console.log("验证通过，用户符合资格");
  } else {
    console.log("验证失败或用户不符合资格");
  }
} catch (error) {
  console.error("证明验证失败:", error.message);
}
```

## 测试

### 测试文件

- `frontend/test-zk-service.js`: 基本参数验证测试

### 测试覆盖

✓ 参数验证（generateProof）
✓ 参数验证（verifyProof）
✓ HTTPS协议验证
✓ 错误参数处理

### 运行测试

```bash
node frontend/test-zk-service.js
```

## 需求映射

本实现满足以下需求：

- **需求 3.5**: 实现证明生成API调用
- **需求 4.1**: 实现证明验证API调用
- **需求 9.1**: 使用HTTPS协议进行安全传输
- **需求 11.2**: 处理网络错误
- **需求 11.3**: 处理API错误响应
- **需求 11.4**: 返回用户友好的错误信息

## API端点

### 后端API端点

- **生成证明**: `POST /api/zk/generate-proof`
- **验证证明**: `POST /api/zk/verify-proof`

### 请求格式

#### 生成证明请求

```json
{
  "vc_id": 123,
  "vote_id": 456,
  "wallet_address": "0x1234567890123456789012345678901234567890123456789012345678901234"
}
```

#### 验证证明请求

```json
{
  "proof": {
    "pi_a": [...],
    "pi_b": [...],
    "pi_c": [...],
    "protocol": "groth16"
  },
  "publicSignals": ["1", "1", "1", "1", "1", "5", "0", "0"],
  "vote_id": 456
}
```

## 注意事项

1. **环境变量**: 确保 `NEXT_PUBLIC_BACKEND_BASE_URL` 已正确配置
2. **HTTPS**: 生产环境必须使用HTTPS协议
3. **错误处理**: 所有API调用都应该包含try-catch错误处理
4. **参数验证**: 调用前确保参数类型和格式正确

## 下一步

- 任务 8.2: 实现错误处理（已在本实现中包含）
- 任务 9: 创建资格验证对话框组件，使用这些API函数
- 集成测试: 与后端API进行完整的集成测试

## 更新日志

- 2026-01-26: 初始实现，包含generateProof和verifyProof函数
- 2026-01-26: 添加HTTPS协议验证
- 2026-01-26: 添加完整的参数验证和错误处理
