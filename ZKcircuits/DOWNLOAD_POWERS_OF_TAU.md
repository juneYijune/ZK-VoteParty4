# 下载Powers of Tau文件

## 问题说明

Powers of Tau文件（`powersOfTau28_hez_final_10.ptau`）是生成ZK证明密钥所需的可信设置参数文件，大小约8MB。

由于网络原因，自动下载可能会失败。

## 手动下载方法

### 方法1：使用浏览器下载（推荐）

1. 在浏览器中打开以下链接：
   ```
   https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
   ```

2. 将下载的文件保存到：
   ```
   ZKcircuits\keys\powersOfTau28_hez_final_10.ptau
   ```

3. 验证文件大小应该约为 **8.3 MB** (8,680,192 字节)

### 方法2：使用PowerShell下载

在ZKcircuits目录下运行：

```powershell
$url = "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau"
$output = "keys\powersOfTau28_hez_final_10.ptau"
Invoke-WebRequest -Uri $url -OutFile $output
```

### 方法3：使用curl下载

```cmd
cd ZKcircuits
curl -o keys\powersOfTau28_hez_final_10.ptau https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
```

### 方法4：使用国内镜像（如果有）

如果您有访问GitHub或其他镜像的方式，可以从以下位置下载：

- GitHub镜像（如果有人上传）
- 其他ZK项目的备份

## 验证下载

下载完成后，验证文件：

```cmd
cd ZKcircuits\keys
dir powersOfTau28_hez_final_10.ptau
```

应该显示文件大小约为 8,680,192 字节。

## 下载完成后

下载完成后，继续运行setup脚本：

```cmd
cd ZKcircuits
npm run setup
```

## 备用方案

如果实在无法下载，您可以：

1. 使用更小的Powers of Tau文件（但可能不够用）
2. 联系项目维护者获取文件
3. 使用VPN或代理下载

## 文件说明

- **文件名**: powersOfTau28_hez_final_10.ptau
- **大小**: 约8.3 MB
- **用途**: ZK-SNARK可信设置参数
- **来源**: Hermez Network（以太坊Layer 2项目）
- **安全性**: 这是公开的、经过多方计算验证的可信设置参数

## 常见问题

### Q: 这个文件安全吗？
A: 是的。这是Hermez Network通过多方计算（MPC）仪式生成的公开可信设置参数，已被广泛使用。

### Q: 为什么需要这个文件？
A: ZK-SNARK需要可信设置参数来生成证明密钥和验证密钥。这个文件包含了预计算的参数。

### Q: 可以使用其他Powers of Tau文件吗？
A: 可以，但需要确保文件的"powers"足够大。我们使用的是2^28，适合大多数中等复杂度的电路。

### Q: 下载速度很慢怎么办？
A: 可以使用下载工具（如IDM、迅雷等）或者寻找国内镜像。
