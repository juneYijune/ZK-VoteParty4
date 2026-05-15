# ZK 零知识证明性能优化指南

## 问题描述

零知识证明生成变慢，从之前的 5-10 秒增加到 30+ 秒。

## 根本原因

**Node.js 内存不足**

错误信息：
```
Could not allocate 2147418112 bytes. This may cause severe instability. 
Trying with 1073709056 bytes
```

- ZK 证明生成需要约 **2GB 内存**
- Node.js 默认内存限制约 **1.4GB**（32位系统）或 **1.7GB**（64位系统）
- 内存分配失败后，snarkjs 降级使用更小的内存
- 导致性能大幅下降

## 解决方案

### 1. 增加 Node.js 内存限制（已实施）

修改 `package.json` 启动脚本：

```json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 ./src/server.js"
  }
}
```

参数说明：
- `--max-old-space-size=4096`：设置最大内存为 4GB
- 可根据系统内存调整（建议 4GB-8GB）

### 2. 手动运行时增加内存

如果直接运行 Node.js 脚本：

```bash
# Windows PowerShell
node --max-old-space-size=4096 ./src/server.js

# 测试脚本
node --max-old-space-size=4096 test-zk-performance-detailed.js
```

### 3. 系统要求

**最低配置：**
- CPU: 4核心
- 内存: 8GB RAM
- 可用内存: 至少 4GB

**推荐配置：**
- CPU: 8核心或更高
- 内存: 16GB RAM
- 可用内存: 至少 8GB

## 性能基准

### 优化前（内存不足）
- 证明生成: **~30 秒**
- 证明验证: **~0.02 秒**
- 总耗时: **~30 秒**

### 优化后（内存充足）
- 证明生成: **5-10 秒**
- 证明验证: **~0.02 秒**
- 总耗时: **5-10 秒**

## 性能监控

运行性能测试：

```bash
cd backend
node --max-old-space-size=4096 test-zk-performance-detailed.js
```

## 其他优化建议

### 1. 关闭不必要的程序
- 浏览器多个标签页
- 其他开发工具
- 后台应用

### 2. 使用生产模式
```bash
NODE_ENV=production npm start
```

### 3. 考虑使用 Worker Threads
将 ZK 证明生成放到独立的 Worker Thread 中，避免阻塞主线程。

### 4. 缓存机制
对于相同的输入，可以缓存证明结果（注意安全性）。

### 5. 硬件升级
- 使用更快的 CPU（更高的单核性能）
- 增加系统内存
- 使用 SSD 硬盘

## 故障排查

### 问题：仍然很慢

1. **检查内存限制是否生效**
   ```bash
   node --max-old-space-size=4096 -e "console.log(v8.getHeapStatistics())"
   ```

2. **检查系统可用内存**
   ```bash
   # Windows
   systeminfo | findstr /C:"Available Physical Memory"
   
   # Linux/Mac
   free -h
   ```

3. **检查 CPU 使用率**
   - 打开任务管理器
   - 查看 Node.js 进程的 CPU 使用率
   - 应该接近 100%（单核）

### 问题：内存溢出

如果出现 `JavaScript heap out of memory` 错误：

1. 进一步增加内存限制：
   ```bash
   node --max-old-space-size=8192 ./src/server.js
   ```

2. 检查是否有内存泄漏

## 总结

通过增加 Node.js 内存限制到 4GB，ZK 证明生成性能可以提升 **3-6 倍**（从 30 秒降到 5-10 秒）。

这是一个简单但非常有效的优化方案！
