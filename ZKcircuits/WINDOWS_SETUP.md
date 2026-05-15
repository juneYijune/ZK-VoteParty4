# Windows系统设置指南

本指南专门针对Windows用户，提供详细的安装和使用说明。

## 前置要求

### 1. 安装Node.js

从官网下载并安装Node.js (v16或更高版本)：
https://nodejs.org/

验证安装：
```cmd
node --version
npm --version
```

### 2. 安装Circom

#### 方法1: 使用预编译二进制文件（推荐）

1. 从GitHub下载Windows版本的Circom：
   https://github.com/iden3/circom/releases

2. 下载 `circom-windows-amd64.exe`

3. 重命名为 `circom.exe` 并添加到PATH环境变量

4. 验证安装：
   ```cmd
   circom --version
   ```

#### 方法2: 使用WSL (Windows Subsystem for Linux)

如果您安装了WSL，可以在WSL中使用Linux版本的工具：

```bash
# 在WSL中安装Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装Circom
cargo install circom
```

### 3. 安装snarkjs

```cmd
npm install -g snarkjs
```

验证安装：
```cmd
snarkjs --version
```

### 4. 安装curl（用于下载Powers of Tau文件）

Windows 10/11通常已经包含curl。验证：
```cmd
curl --version
```

如果没有curl，可以：
- 使用PowerShell的 `Invoke-WebRequest`
- 或手动下载文件

## 快速开始

### 1. 安装依赖

```cmd
cd ZKcircuits
npm install
```

### 2. 编译电路

**使用批处理脚本（推荐）：**
```cmd
scripts\compile.bat
```

**或使用npm脚本：**
```cmd
npm run compile
```

### 3. 生成密钥

**使用批处理脚本（推荐）：**
```cmd
scripts\setup.bat
```

**或使用npm脚本：**
```cmd
npm run setup
```

### 4. 测试电路（可选）

如果您安装了Git Bash或WSL：
```bash
bash scripts/test-circuit.sh
```

## 常见问题

### 问题1: 'circom' 不是内部或外部命令

**原因**: Circom未正确安装或未添加到PATH

**解决方案**:
1. 确认circom.exe的位置
2. 将该目录添加到系统PATH环境变量
3. 重启命令提示符

### 问题2: PowerShell执行策略限制

**错误信息**: "无法加载文件，因为在此系统上禁止运行脚本"

**解决方案**:
```powershell
# 以管理员身份运行PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 问题3: curl下载失败

**解决方案**: 手动下载Powers of Tau文件

1. 在浏览器中打开：
   https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau

2. 下载文件到 `ZKcircuits\keys\` 目录

3. 重新运行setup脚本

### 问题4: 内存不足

**解决方案**: 增加Node.js内存限制

```cmd
set NODE_OPTIONS=--max-old-space-size=4096
npm run compile
```

### 问题5: 路径中包含空格或中文

**解决方案**: 
- 确保项目路径不包含空格或中文字符
- 使用短路径名称
- 或使用WSL

## 使用Git Bash（推荐）

如果您安装了Git for Windows，可以使用Git Bash运行bash脚本：

1. 右键点击 `ZKcircuits` 目录
2. 选择 "Git Bash Here"
3. 运行bash脚本：
   ```bash
   bash scripts/compile.sh
   bash scripts/setup.sh
   bash scripts/test-circuit.sh
   ```

## 使用WSL（高级用户）

WSL提供完整的Linux环境，是最接近生产环境的开发方式：

1. 安装WSL2：
   ```cmd
   wsl --install
   ```

2. 在WSL中安装依赖：
   ```bash
   # 安装Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # 安装Rust和Circom
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   cargo install circom
   
   # 安装snarkjs
   npm install -g snarkjs
   ```

3. 在WSL中运行脚本：
   ```bash
   cd /mnt/c/path/to/ZKcircuits
   npm run compile
   npm run setup
   ```

## 验证安装

运行以下命令验证所有工具已正确安装：

```cmd
node --version
npm --version
circom --version
snarkjs --version
curl --version
```

所有命令都应该返回版本号。

## 下一步

安装完成后，请参考主README.md文件了解如何使用电路。

## 获取帮助

如果遇到问题：
1. 检查本文档的"常见问题"部分
2. 查看主README.md文件
3. 联系项目维护者
