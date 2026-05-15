# 任务5实现总结：增强VC API

## 概述

成功实现了获取用户有效VC列表的API接口，该接口使用 `wallet_address` 标识用户，并通过 Poseidon 哈希计算 `wallet_hash` 来查询数据库。

## 实现内容

### 1. 控制器函数 (backend/src/controllers/vc.controller.js)

添加了 `getMyValidVCs` 控制器函数：

**功能**:
- 从请求头 `X-Wallet-Address` 获取用户的钱包地址
- 验证钱包地址格式（以太坊地址：0x + 40位十六进制）
- 使用 Poseidon 哈希算法计算 `wallet_hash`
- 查询数据库获取该用户的所有有效VC（vc_status=1）
- 返回统一的JSON响应格式

**请求格式**:
```
GET /api/vc/my-valid-vcs
Headers:
  X-Wallet-Address: 0x1234567890123456789012345678901234567890
```

**响应格式**:
```json
{
  "success": true,
  "data": [
    {
      "vc_id": 1,
      "vc_type": "PARTY_MEMBER",
      "vc_content": {
        "isFormalPartyMember": true,
        "partyYears": 6,
        "partyOrgCode": "ORG001",
        "partyStatus": 1,
        "paidPartyFee": true,
        "conflictFree": true
      },
      "vc_status": 1,
      "vc_issued_at": "2026-01-01T00:00:00.000Z",
      ...
    }
  ]
}
```

**错误处理**:
- 400: wallet_address 缺失或格式无效
- 500: 服务器内部错误

### 2. 路由配置 (backend/src/routes/vc.js)

添加了新的路由：
```javascript
router.get("/my-valid-vcs", vcController.getMyValidVCs);
```

### 3. 关键技术点

#### Poseidon 哈希
- 使用 `partyUsers.service.js` 中的 `poseidonHashAddress` 方法
- 将以太坊地址转换为 Poseidon 哈希值
- 与数据库中的 `vc_holder_wallet_hash` 字段匹配

#### 数据过滤
- 只返回 `vc_status=1` 的有效VC
- 自动解析 JSON 格式的 `vc_content` 字段
- 分页支持（默认获取前100条）

## 验证需求

✅ 需求 7.1: 提供 GET /api/vc/my-valid-vcs 接口获取用户有效VC列表
✅ 需求 7.5: 使用 wallet_address 而不是 user_id 来标识用户

## 测试

创建了测试文件 `backend/test-my-valid-vcs.js`，包含以下测试场景：

1. ✓ 使用有效的 wallet_address 获取VC列表
2. ✓ 验证只返回 vc_status=1 的VC
3. ✓ 测试缺少 wallet_address 头部的错误处理
4. ✓ 测试无效 wallet_address 格式的错误处理

**运行测试**:
```bash
# 注意：需要先安装 axios
npm install axios --save-dev

# 确保后端服务运行在 http://localhost:3000
npm start

# 在另一个终端运行测试
node test-my-valid-vcs.js
```

## 数据库表结构

```sql
CREATE TABLE verifiable_credentials (
    vc_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vc_holder_wallet_hash CHAR(66) NOT NULL,  -- Poseidon 哈希
    vc_content JSON NOT NULL,
    vc_status TINYINT DEFAULT 1,  -- 1=有效, 0=撤销
    ...
);
```

## API使用示例

### 使用 curl 测试

```bash
curl -X GET http://localhost:3000/api/vc/my-valid-vcs \
  -H "X-Wallet-Address: 0x1234567890123456789012345678901234567890"
```

### 使用 JavaScript/前端

```javascript
const response = await fetch('http://localhost:3000/api/vc/my-valid-vcs', {
  method: 'GET',
  headers: {
    'X-Wallet-Address': walletAddress
  }
});

const result = await response.json();
if (result.success) {
  console.log('有效VC列表:', result.data);
}
```

## 下一步

该接口将在前端的资格验证对话框中使用，用于：
1. 显示用户可用的VC列表
2. 让用户选择一个VC进行零知识证明验证
3. 确保只使用有效的VC进行验证

## 相关文件

- `backend/src/controllers/vc.controller.js` - 控制器实现
- `backend/src/routes/vc.js` - 路由配置
- `backend/src/services/vc.service.js` - VC服务（已存在）
- `backend/src/services/partyUsers.service.js` - Poseidon 哈希工具
- `backend/test-my-valid-vcs.js` - 测试文件
