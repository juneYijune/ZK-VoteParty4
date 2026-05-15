# 后端（backend）

## 运行方式

1. 安装依赖

```bash
npm install
```
"D:\profession\Redis\redis\redis-cli.exe" ping
2. 启动```bash
$env:REDIS_URL="redis://127.0.0.1:6379"
npm start
```

默认端口来自 `backend/bin/www`：

- `process.env.PORT || 3000`

如果你想换端口（PowerShell）：

```powershell
$env:PORT=3001; npm start
```

## 合约部署账户（deploy:localhost）是谁？

当你执行：

```bash
npm run deploy:localhost
```

它会连接到 `contracts/hardhat.config.js` 里配置的 `localhost` 网络（`http://127.0.0.1:8545`），并使用 **Hardhat Node 默认提供的第 1 个账户（Account #0 / 第一个 signer）** 来部署。

我已经在 `contracts/scripts/deploy.js` 里加入了打印信息，所以你运行部署时会看到类似输出：

- `Deployer: 0x...`
- `Deployer balance: ... ETH`
- `Network: localhost chainId= 31337`

这行 `Deployer` 地址就是本次部署使用的账户。

## 前后端如何拿到合约地址

`npm run deploy:localhost` 会输出：

- `PartyVoting deployed to: 0x...`

把这个地址写入前端：

- `frontend/.env.local`
  - `NEXT_PUBLIC_PARTY_VOTING_ADDRESS=0x...`

并在合约修改后执行 ABI 导出：

```powershell
# PowerShell 用分号分隔命令
npm run compile; npm run export:abi:frontend
```

会更新：

- `frontend/contracts/PartyVoting.abi.js`



# 系统日志同步指南

## 问题说明

系统操作审计日志（`system_logs` 表）没有数据的原因：

1. **事件监听器只监听新事件** - `eventListener.service.js` 只会记录从后端服务启动后发生的新区块链事件
2. **历史事件不会自动记录** - 在事件监听器启动之前发生的操作不会被自动记录到数据库

## 解决方案

### 方案 1：同步历史事件（推荐）

运行历史事件同步脚本，将已发生的区块链事件同步到数据库：

```bash
cd backend
node sync-historical-events.js
```

这个脚本会：
- 查询区块链上的所有历史事件
- 将事件数据写入 `system_logs` 表
- 自动跳过已存在的记录（通过 `tx_hash` 去重）

### 方案 2：执行新操作

执行新的区块链操作，事件监听器会自动记录：

1. 添加/移除党组织管理员
2. 创建投票
3. 投票
4. 开始/结束投票

这些操作会触发智能合约事件，事件监听器会自动捕获并记录到数据库。

## 事件监听器工作原理

### 1. 启动时机

事件监听器在后端服务启动时自动初始化（`src/server.js`）：

```javascript
if (contractAddress) {
  eventListener.initEventListener(rpcUrl, contractAddress);
  console.log('事件监听器已启动');
}
```

### 2. 监听的事件类型

| 事件名称 | 日志类型 | 说明 |
|---------|---------|------|
| PartyOrgAdded | PARTY_ORG_ADD | 添加党组织管理员 |
| PartyOrgRemoved | PARTY_ORG_REMOVE | 撤销党组织管理员 |
| VoteCreated | VOTE_CREATE | 创建投票 |
| Voted | VOTE_CAST | 投票 |
| startVoted | START_VOTE | 开始投票 |
| endVoted | END_VOTE | 结束投票 |

### 3. 记录的信息

每条日志记录包含：
- `log_type`: 日志类型
- `operator_address`: 操作人地址
- `target_address`: 目标地址（如党组织地址）
- `vote_id`: 关联投票 ID
- `action_desc`: 操作描述
- `logs_status`: 操作状态（1=成功）
- `tx_hash`: 区块链交易哈希
- `block_number`: 区块号
- `block_timestamp`: 区块时间戳

## 测试验证

运行测试脚本验证系统日志功能：

```bash
cd backend
node test-event-listener.js
```

测试内容：
1. 检查 `system_logs` 表是否存在
2. 查看表中的数据
3. 验证环境变量配置
4. 测试事件监听器初始化
5. 检查区块链连接

## 查看系统日志

### 通过 API

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

### 通过前端

访问系统管理员审计日志页面：
```
http://localhost:3000/admin/logs
```

## 注意事项

1. **确保后端服务运行** - 事件监听器需要后端服务运行才能工作
2. **确保区块链节点运行** - 需要连接到 Hardhat 本地节点或其他以太坊节点
3. **合约地址配置** - 确保 `.env` 文件中的 `CONTRACT_ADDRESS` 正确
4. **首次使用需同步** - 首次使用或重新部署合约后，需要运行同步脚本
5. **自动去重** - 同步脚本会自动跳过已存在的记录，可以安全地重复运行

## 故障排查

### 问题：表中没有数据

**原因**：
- 事件监听器启动前的操作不会被记录
- 后端服务未运行
- 区块链节点未运行

**解决**：
1. 运行 `node sync-historical-events.js` 同步历史事件
2. 确保后端服务正在运行
3. 确保区块链节点正在运行

### 问题：事件监听器未启动

**原因**：
- `CONTRACT_ADDRESS` 未配置
- RPC URL 不正确

**解决**：
1. 检查 `.env` 文件中的配置
2. 确保合约已部署
3. 确保区块链节点可访问

### 问题：同步脚本报错

**原因**：
- 数据库连接失败
- 区块链连接失败
- 合约地址错误

**解决**：
1. 检查数据库配置和连接
2. 检查区块链节点是否运行
3. 验证合约地址是否正确

## 维护建议

1. **定期检查** - 定期检查日志记录是否正常
2. **监控服务** - 监控后端服务和事件监听器状态
3. **备份数据** - 定期备份 `system_logs` 表数据
4. **清理旧数据** - 根据需要清理过期的日志数据

## 相关文件

- `src/services/eventListener.service.js` - 事件监听器服务
- `src/services/systemLogs.service.js` - 系统日志服务
- `src/controllers/systemLogs.controller.js` - 系统日志控制器
- `sync-historical-events.js` - 历史事件同步脚本
- `test-event-listener.js` - 测试脚本
