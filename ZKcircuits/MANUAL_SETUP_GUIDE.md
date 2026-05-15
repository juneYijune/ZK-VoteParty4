# 手动设置指南

由于网络限制，Powers of Tau文件无法自动下载。请按照以下步骤手动完成设置。

## 当前状态

✅ **电路编译成功！**

您已经成功完成：
- Circom 2.2.3 安装
- 电路编译（生成了 .r1cs 和 .wasm 文件）

## 下一步：下载Powers of Tau文件

### 选项1：从备用源下载

尝试以下备用下载地址（选择一个可用的）：

1. **Hermez官方（原始地址）**:
   ```
   https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
   ```

2. **GitHub镜像**:
   ```
   https://github.com/iden3/snarkjs/blob/master/README.md
   ```
   （查看README中的下载链接）

3. **IPFS**:
   ```
   https://ipfs.io/ipfs/QmTiT4iFrpeFK3KgNTmqVGXKmXCbdqfHnXvZJzQvyKy1FE
   ```

### 选项2：使用更小的测试文件（仅用于测试）

如果只是想测试流程，可以使用更小的Powers of Tau文件：

```
https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_08.ptau
```

然后修改 `scripts\setup.bat` 中的文件名。

### 选项3：跳过密钥生成（暂时）

如果您只想验证电路逻辑，可以暂时跳过密钥生成步骤，直接进行后续的后端开发。

## 下载完成后

1. 将文件放到 `ZKcircuits\keys\powersOfTau28_hez_final_10.ptau`

2. 验证文件大小：
   ```cmd
   dir keys\powersOfTau28_hez_final_10.ptau
   ```
   应该显示约 8,680,192 字节

3. 运行setup脚本：
   ```cmd
   npm run setup
   ```

## 完整的手动设置步骤

如果自动脚本完全无法工作，您可以手动执行以下命令：

### 1. 生成初始zkey

```cmd
snarkjs groth16 setup build\eligibleVoter.r1cs keys\powersOfTau28_hez_final_10.ptau build\eligibleVoter_0000.zkey
```

### 2. 贡献随机性

```cmd
echo random entropy | snarkjs zkey contribute build\eligibleVoter_0000.zkey build\eligibleVoter_final.zkey --name="First contribution" -v
```

### 3. 导出verification key

```cmd
snarkjs zkey export verificationkey build\eligibleVoter_final.zkey keys\verification_key.json
```

## 验证设置完成

设置完成后，您应该有以下文件：

```
ZKcircuits/
├── build/
│   ├── eligibleVoter.r1cs              ✅ 已生成
│   ├── eligibleVoter_js/
│   │   └── eligibleVoter.wasm          ✅ 已生成
│   ├── eligibleVoter_0000.zkey         ⏳ 待生成
│   └── eligibleVoter_final.zkey        ⏳ 待生成
└── keys/
    ├── powersOfTau28_hez_final_10.ptau ⏳ 需要下载
    └── verification_key.json           ⏳ 待生成
```

## 继续开发

即使没有完成密钥生成，您也可以继续进行：

1. **后端API开发**（任务2-5）
   - 实现数据映射函数
   - 创建API路由和控制器
   - 编写单元测试

2. **前端组件开发**（任务7-11）
   - LocalStorage工具模块
   - API服务模块
   - UI组件

稍后当网络条件允许时，再完成密钥生成步骤。

## 需要帮助？

如果您需要这个文件但无法下载，可以：

1. 使用VPN或代理
2. 请同事帮忙下载
3. 联系项目维护者
4. 在项目issue中寻求帮助

## 任务1完成状态

✅ ZK电路目录结构已设置
✅ 电路源文件已创建
✅ 编译脚本已创建并测试成功
✅ 电路编译成功
⏳ 密钥生成（等待Powers of Tau文件）

**任务1基本完成！** 剩余的密钥生成步骤可以在网络条件允许时完成。
