# 系统日志同步指南

## 功能说明

系统操作审计日志（`system_logs` 表）记录所有区块链操作。

### 工作机制

**后端启动时：**
- ✅ 启动实时事件监听器，监听新发生的事件
- ❌ 不会自动同步历史事件

**需要同步历史事件时：**
- 手动运行同步脚本：`node sync-historical-events.js`

## 手动同步历史事件

当你需要同步历史区块链事件到数据库时，运行：

```bash
cd backend
node sync-historical-events.js
```

### 同步脚本功能

- 查询区块链上的所有历史事件（从区块 0 到当前区块）
- 将事件数据写入 `system_logs` 表
- 自动跳过已存在的记录（通过 `tx_hash` 去重）
- 可以安全地重复运行

### 何时需要手动同步

1. **首次启动项目** - 同步之前发生的所有事件
2. **重新部署合约** - 同步新合约的事件
3. **数据库清空后** - 重新导入历史数据
4. **发现数据缺失** - 补充遗漏的事件记录

## 实时事件监听

后端启动时会自动启动实时事件监听器，监听以下事件：

| 事件名称 | 日志类型 | 说明 |
|---------|---------|------|
| PartyOrgAdded | PARTY_ORG_ADD | 添加党组织管理员 |
| PartyOrgRemoved | PARTY_ORG_REMOVE | 撤销党组织管理员 |
| VoteCreated | VOTE_CREATE | 创建投票 |
| Voted | VOTE_CAST | 投票 |
| startVoted | START_VOTE | 开始投票 |
| endVoted | END_VOTE | 结束投票 |

## 记录的信息

每条日志包含：
- `log_type`: 日志类型
- `operator_address`: 操作人地址
- `target_address`: 目标地址（如党组织地址）
- `vote_id`: 关联投票 ID
- `action_desc`: 操作描述
- `logs_status`: 操作状态（1=成功）
- `tx_hash`: 区块链交易哈希
- `block_number`: 区块号
- `block_timestamp`: 区块时间戳
- `created_at`: 日志入库时间

## 使用说明

### 启动后端服务

```bash
cd backend
npm run dev
```

后端启动后会自动启动实时事件监听器，监听新发生的区块链事件。

### 手动同步历史事件

如需同步历史事件，运行：

```bash
cd backend
node sync-historical-events.js
```

**输出示例：**
```
=== 开始同步历史事件 ===

当前区块高度: 15
查询区块范围: 0 - 15

1. 同步 PartyOrgAdded 事件...
   找到 2 个事件
   ✅ 记录事件: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
   ✅ 记录事件: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

2. 同步 VoteCreated 事件...
   找到 3 个事件
   ✅ 记录事件: 投票 ID 1
   ✅ 记录事件: 投票 ID 2
   ✅ 记录事件: 投票 ID 3

=== 同步完成 ===
总共同步了 5 个事件到 system_logs 表
```

### 查看日志

**通过 API：**

```bash
# 获取所有日志
curl http://localhost:3001/api/system-logs/list

# 按类型筛选
curl http://localhost:3001/api/system-logs/list?log_type=PARTY_ORG_ADD

# 按操作人筛选
curl http://localhost:3001/api/system-logs/list?operator_address=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# 分页
curl http://localhost:3001/api/system-logs/list?page=1&pageSize=20

# 获取统计信息
curl http://localhost:3001/api/system-logs/statistics
```

**通过前端：**

访问系统管理员审计日志页面：
```
http://localhost:3000/admin/logs
```

## 手动同步（按需使用）

当需要同步历史事件时，运行：

```bash
cd backend
node sync-historical-events.js
```

**适用场景：**
- 首次启动项目
- 重新部署合约后
- 数据库清空后需要恢复数据
- 发现审计日志数据缺失

## 工作流程

```
启动后端服务
    ↓
启动实时事件监听器
    ↓
持续监听新事件并记录
    
（需要时）手动运行同步脚本
    ↓
同步历史事件到数据库
```

## 优势

### 当前方案
- ✅ 启动速度快，无需等待同步
- ✅ 实时监听新事件，无延迟
- ✅ 按需同步历史数据，灵活控制
- ✅ 避免每次启动都扫描区块链

## 配置要求

确保 `.env` 文件中配置正确：

```env
# 区块链配置
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

## 故障排查

### 问题：启动时没有同步历史事件

**说明：**
- 这是正常的，系统不会自动同步历史事件
- 只会启动实时监听器，监听新事件

**如需同步历史事件：**
```bash
cd backend
node sync-historical-events.js
```

### 问题：表中没有历史数据

**原因：**
- 后端启动前发生的事件不会被自动记录
- 需要手动运行同步脚本

**解决：**
```bash
cd backend
node sync-historical-events.js
```

### 问题：重复记录

**不会发生：**
- 系统通过 `tx_hash` 自动去重
- 可以安全地多次重启服务
- 不会产生重复的日志记录

## 性能说明

- **后端启动** - 快速启动，立即可用
- **实时监听** - 新事件立即记录，无延迟
- **手动同步** - 按需执行，首次可能需要几秒钟（取决于区块数量）

## 相关文件

- `src/server.js` - 启动实时事件监听器
- `src/services/eventListener.service.js` - 事件监听和同步服务
- `src/services/systemLogs.service.js` - 系统日志数据库操作
- `sync-historical-events.js` - 手动同步脚本

## 总结

**启动后端：**
- 自动启动实时事件监听器
- 新事件会被自动记录

**需要历史数据时：**
- 手动运行 `node sync-historical-events.js`
- 同步所有历史事件到数据库

**优点：**
- 启动快速
- 灵活控制
- 按需同步
