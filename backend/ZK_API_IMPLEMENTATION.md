# ZK API路由和控制器实现总结

## 概述

本文档总结了任务4"后端：ZK API路由和控制器"的实现，包括ZK证明生成和验证的API接口。

## 实现的文件

### 1. backend/src/routes/zk.js
ZK路由定义文件，注册了两个API端点：
- `POST /api/zk/generate-proof` - 生成零知识证明
- `POST /api/zk/verify-proof` - 验证零知识证明

### 2. backend/src/controllers/zk.controller.js
ZK控制器实现，包含两个主要函数：

#### generateProof(req, res)
**功能**: 处理证明生成请求

**请求参数**:
```json
{
  "vc_id": 1,
  "vote_id": 123,
  "wallet_address": "0x1234..."
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "proof": { /* 证明对象 */ },
    "publicSignals": [ /* 公共信号数组 */ ]
  }
}
```

**验证逻辑**:
- 验证VC ID是否有效（正整数）
- 验证投票ID是否有效（正整数）
- 验证钱包地址格式（64位十六进制）
- 使用wallet_address标识用户（需求7.5）
- 不记录私有输入到日志（需求9.2）

#### verifyProof(req, res)
**功能**: 处理证明验证请求

**请求参数**:
```json
{
  "proof": { /* 证明对象 */ },
  "publicSignals": [ /* 公共信号数组 */ ],
  "vote_id": 123
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "isEligible": true
  }
}
```

**验证逻辑**:
- 验证proof对象是否有效
- 验证publicSignals数组是否有效
- 验证投票ID是否有效

### 3. backend/src/controllers/zk.errorCodes.js
错误代码定义文件，统一了错误响应格式。

**错误代码列表**:
- `INVALID_INPUT` - 输入数据无效
- `VC_NOT_FOUND` - VC不存在或不属于该用户
- `VC_REVOKED` - VC已被撤销或无效
- `VC_SIGNATURE_INVALID` - VC签名验证失败
- `VOTE_NOT_FOUND` - 投票不存在或已结束
- `PROOF_GENERATION_FAILED` - 证明生成失败
- `PROOF_VERIFICATION_FAILED` - 证明验证失败
- `NOT_ELIGIBLE` - 不满足资格要求
- `NETWORK_ERROR` - 网络错误
- `STORAGE_ERROR` - 存储错误

**统一错误响应格式**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好的错误信息"
  }
}
```

### 4. backend/src/app.js（更新）
在主应用文件中注册了ZK路由：
```javascript
var zkRouter = require('./routes/zk');
app.use('/api/zk', zkRouter);
```

## 满足的需求

### 需求7.3: 提供证明生成接口
✓ 实现了 `POST /api/zk/generate-proof` 接口

### 需求7.4: 提供证明验证接口
✓ 实现了 `POST /api/zk/verify-proof` 接口

### 需求7.5: 使用wallet_address标识用户
✓ 所有API接口使用wallet_address而不是user_id

### 需求7.6: 明确的错误代码和错误信息
✓ 定义了统一的错误响应格式和错误代码

### 需求9.2: 不记录私有输入到日志
✓ 控制器中只记录VC ID、投票ID和钱包地址，不记录VC内容

## API端点

### 生成证明
```
POST /api/zk/generate-proof
Content-Type: application/json

{
  "vc_id": 1,
  "vote_id": 123,
  "wallet_address": "0x1234567890abcdef..."
}
```

### 验证证明
```
POST /api/zk/verify-proof
Content-Type: application/json

{
  "proof": { ... },
  "publicSignals": [ ... ],
  "vote_id": 123
}
```

## 错误处理

所有错误都遵循统一的响应格式，包含：
- `success`: false
- `error.code`: 错误代码
- `error.message`: 用户友好的错误信息

HTTP状态码根据错误类型返回：
- 400: 输入验证错误
- 404: 资源不存在
- 500: 服务器内部错误

## 测试

创建了测试脚本 `backend/test-zk-api.js` 用于验证API功能：
- 测试证明生成API
- 测试证明验证API
- 测试无效输入处理

运行测试：
```bash
cd backend
node test-zk-api.js
```

## 注意事项

1. **隐私保护**: 控制器不会在日志中记录VC的私有内容
2. **钱包地址格式**: 要求64位十六进制格式（Keccak-256哈希）
3. **错误处理**: 所有错误都有明确的错误代码和用户友好的消息
4. **参数验证**: 所有输入参数都经过严格验证

## 下一步

任务4已完成。可以继续执行任务5"后端：增强VC API"。
