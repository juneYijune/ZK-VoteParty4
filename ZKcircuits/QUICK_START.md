# 快速开始指南

## 一键设置（推荐）

### 前提条件
确保已安装：
- Node.js (v16+)
- Circom (v2.0+)
- snarkjs

### 完整设置流程

```bash
# 1. 进入目录
cd ZKcircuits

# 2. 安装依赖
npm install

# 3. 编译电路
npm run compile

# 4. 生成密钥
npm run setup

# 5. 测试电路（可选）
npm run test-circuit
```

## Windows用户

如果您使用Windows系统，请查看 `WINDOWS_SETUP.md` 获取详细的Windows设置指南。

**快速命令（Windows命令提示符）:**
```cmd
cd ZKcircuits
npm install
scripts\compile.bat
scripts\setup.bat
```

## 验证安装

运行以下命令检查所有工具是否正确安装：

```bash
node --version    # 应显示 v16.x.x 或更高
circom --version  # 应显示 2.x.x 或更高
snarkjs --version # 应显示版本号
```

## 预期结果

成功完成后，您应该看到以下文件：

```
ZKcircuits/
├── build/
│   ├── eligibleVoter.r1cs
│   ├── eligibleVoter_js/
│   │   └── eligibleVoter.wasm
│   └── eligibleVoter_final.zkey
└── keys/
    ├── powersOfTau28_hez_final_10.ptau
    └── verification_key.json
```

## 下一步

1. 查看 `README.md` 了解详细的使用说明
2. 查看 `SETUP_COMPLETE.md` 了解如何集成到后端
3. 开始实现后端API（任务2-5）

## 常见问题

**Q: 编译失败，提示找不到circom命令**
A: 请确保已正确安装Circom并添加到PATH环境变量

**Q: Powers of Tau下载失败**
A: 可以手动下载文件到 keys/ 目录，下载地址在 setup.sh 脚本中

**Q: 内存不足错误**
A: 运行 `export NODE_OPTIONS="--max-old-space-size=4096"` 增加内存限制

## 获取帮助

- 查看 `README.md` 获取完整文档
- 查看 `WINDOWS_SETUP.md` 获取Windows特定帮助
- 查看 `SETUP_COMPLETE.md` 了解集成说明
