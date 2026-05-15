@echo off
chcp 65001 >nul
REM 生成 Solidity 验证器合约
echo 正在生成 Solidity 验证器合约...

REM 确保 build 目录存在
if not exist "build" (
    echo 错误: build 目录不存在，请先运行编译脚本
    exit /b 1
)

REM 确保 zkey 文件存在
if not exist "build\eligibleVoter_final.zkey" (
    echo 错误: eligibleVoter_final.zkey 不存在，请先运行设置脚本
    exit /b 1
)

REM 创建临时目录
if not exist "temp" mkdir temp

REM 生成验证器合约到临时目录
echo 生成验证器合约...
npx snarkjs zkey export solidityverifier build\eligibleVoter_final.zkey temp\EligibleVoterVerifier.sol

if %ERRORLEVEL% NEQ 0 (
    echo 错误: 生成验证器合约失败
    exit /b 1
)

REM 复制到 contracts 目录
echo 复制验证器合约到 contracts 目录...
if not exist "..\contracts\contracts" mkdir "..\contracts\contracts"
copy /Y temp\EligibleVoterVerifier.sol ..\contracts\contracts\EligibleVoterVerifier.sol

if %ERRORLEVEL% NEQ 0 (
    echo 错误: 复制验证器合约失败
    exit /b 1
)

REM 清理临时文件
rmdir /S /Q temp

echo.
echo ========================================
echo 验证器合约已生成！
echo ========================================
echo 位置: ..\contracts\contracts\EligibleVoterVerifier.sol
echo.
echo 下一步:
echo 1. cd ..\contracts
echo 2. npx hardhat compile
echo 3. npx hardhat run scripts/deploy-verifier.js --network localhost
echo ========================================
