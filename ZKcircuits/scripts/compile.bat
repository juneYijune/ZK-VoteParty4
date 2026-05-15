@echo off
REM compile.bat
REM Windows批处理版本的编译脚本

echo ==========================================
echo 编译零知识证明电路
echo ==========================================

REM 创建build目录
if not exist "build" mkdir build

REM 编译电路
echo.
echo 步骤 1/3: 编译Circom电路...
circom circuits\eligibleVoter.circom --r1cs --wasm --sym -o build

REM 检查编译结果
if exist "build\eligibleVoter.r1cs" (
    echo ✓ R1CS文件生成成功: build\eligibleVoter.r1cs
) else (
    echo ✗ R1CS文件生成失败
    exit /b 1
)

if exist "build\eligibleVoter_js\eligibleVoter.wasm" (
    echo ✓ WASM文件生成成功: build\eligibleVoter_js\eligibleVoter.wasm
) else (
    echo ✗ WASM文件生成失败
    exit /b 1
)

REM 显示电路信息
echo.
echo 步骤 2/3: 显示电路信息...
snarkjs r1cs info build\eligibleVoter.r1cs

REM 导出R1CS为JSON格式
echo.
echo 步骤 3/3: 导出R1CS为JSON格式...
snarkjs r1cs export json build\eligibleVoter.r1cs build\eligibleVoter.r1cs.json
echo ✓ R1CS JSON导出成功: build\eligibleVoter.r1cs.json

echo.
echo ==========================================
echo 电路编译完成！
echo ==========================================
echo.
echo 生成的文件：
echo   - build\eligibleVoter.r1cs
echo   - build\eligibleVoter_js\eligibleVoter.wasm
echo   - build\eligibleVoter_js\witness_calculator.js
echo   - build\eligibleVoter.sym
echo   - build\eligibleVoter.r1cs.json
echo.
echo 下一步: 运行 'npm run setup' 生成密钥
echo.
