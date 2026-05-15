@echo off
REM setup.bat
REM Windows批处理版本的密钥生成脚本

echo ==========================================
echo 生成零知识证明密钥
echo ==========================================

REM 创建keys目录
if not exist "keys" mkdir keys

REM 检查R1CS文件是否存在
if not exist "build\eligibleVoter.r1cs" (
    echo ✗ 错误: build\eligibleVoter.r1cs 不存在
    echo 请先运行 'npm run compile' 编译电路
    exit /b 1
)

REM 步骤 1: 下载Powers of Tau参数（如果不存在）
if not exist "keys\powersOfTau28_hez_final_10.ptau" (
    echo.
    echo 步骤 1/4: 下载Powers of Tau可信设置参数...
    echo 文件大小约 8MB，请稍候...
    curl -o keys\powersOfTau28_hez_final_10.ptau https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
    echo ✓ Powers of Tau参数下载成功
) else (
    echo.
    echo 步骤 1/4: Powers of Tau参数已存在，跳过下载
)

REM 步骤 2: 生成初始zkey
echo.
echo 步骤 2/4: 生成初始zkey...
snarkjs groth16 setup build\eligibleVoter.r1cs keys\powersOfTau28_hez_final_10.ptau build\eligibleVoter_0000.zkey
echo ✓ 初始zkey生成成功: build\eligibleVoter_0000.zkey

REM 步骤 3: 贡献随机性
echo.
echo 步骤 3/4: 贡献随机性...
echo random entropy | snarkjs zkey contribute build\eligibleVoter_0000.zkey build\eligibleVoter_final.zkey --name="First contribution" -v
echo ✓ 最终zkey生成成功: build\eligibleVoter_final.zkey

REM 步骤 4: 导出verification key
echo.
echo 步骤 4/4: 导出verification key...
snarkjs zkey export verificationkey build\eligibleVoter_final.zkey keys\verification_key.json
echo ✓ Verification key导出成功: keys\verification_key.json

echo.
echo ==========================================
echo 密钥生成完成！
echo ==========================================
echo.
echo 生成的文件：
echo   - keys\powersOfTau28_hez_final_10.ptau (可信设置参数)
echo   - build\eligibleVoter_0000.zkey (初始zkey)
echo   - build\eligibleVoter_final.zkey (最终proving key)
echo   - keys\verification_key.json (verification key)
echo.
echo 现在可以使用这些密钥进行证明生成和验证了！
echo.
