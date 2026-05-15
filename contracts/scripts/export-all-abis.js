const fs = require("fs");
const path = require("path");

/**
 * 导出合约 ABI 到前端
 * @param {string} contractName - 合约名称
 * @param {string} contractPath - 合约文件路径（相对于 contracts 目录）
 * @param {string} outputFileName - 输出文件名（不含扩展名）
 */
function exportABI(contractName, contractPath, outputFileName) {
  console.log(`\n导出 ${contractName} ABI...`);

  const artifactPath = path.resolve(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    contractPath,
    `${contractName}.json`
  );

  if (!fs.existsSync(artifactPath)) {
    console.error(`❌ Artifact 不存在: ${artifactPath}`);
    console.error(`   请先运行: npx hardhat compile`);
    return false;
  }

  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const abi = artifact.abi;

    const outFile = path.resolve(
      __dirname,
      "..",
      "..",
      "frontend",
      "contracts",
      `${outputFileName}.abi.js`
    );

    // 确保输出目录存在
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    // 写入 ABI 文件
    fs.writeFileSync(
      outFile,
      `export default ${JSON.stringify(abi, null, 2)};\n`,
      "utf-8"
    );

    console.log(`✓ ABI 已导出: ${outputFileName}.abi.js`);
    return true;
  } catch (error) {
    console.error(`❌ 导出失败:`, error.message);
    return false;
  }
}

// 可用的合约配置
const AVAILABLE_CONTRACTS = {
  "PartyVoting": {
    name: "PartyVoting",
    path: "PartyVoting.sol",
    output: "PartyVoting"
  },
  "VotingEligibilityVerifier": {
    name: "VotingEligibilityVerifier",
    path: "VotingEligibilityVerifier.sol",
    output: "VotingEligibilityVerifier"
  }
};

function showUsage() {
  console.log("\n用法:");
  console.log("  node export-all-abis.js [contract-name]");
  console.log("\n参数:");
  console.log("  contract-name  要导出的合约名称（可选）");
  console.log("\n可用的合约:");
  Object.keys(AVAILABLE_CONTRACTS).forEach(name => {
    console.log(`  - ${name}`);
  });
  console.log("\n示例:");
  console.log("  node export-all-abis.js                    # 导出所有合约");
  console.log("  node export-all-abis.js PartyVoting        # 只导出 PartyVoting");
  console.log("  node export-all-abis.js VotingEligibilityVerifier  # 只导出验证器");
  console.log("\n或使用 npm 脚本:");
  console.log("  npm run export:abi                         # 导出所有合约");
  console.log("  npm run export:abi PartyVoting             # 只导出 PartyVoting");
  console.log("");
}

function main() {
  const args = process.argv.slice(2);
  
  // 如果有 --help 或 -h 参数，显示帮助
  if (args.includes("--help") || args.includes("-h")) {
    showUsage();
    return;
  }

  console.log("========================================");
  console.log("导出合约 ABI 到前端");
  console.log("========================================");

  let contractsToExport = [];

  // 如果指定了合约名称
  if (args.length > 0) {
    const contractName = args[0];
    
    if (!AVAILABLE_CONTRACTS[contractName]) {
      console.error(`\n❌ 错误: 未知的合约名称 "${contractName}"`);
      console.log("\n可用的合约:");
      Object.keys(AVAILABLE_CONTRACTS).forEach(name => {
        console.log(`  - ${name}`);
      });
      process.exit(1);
    }
    
    contractsToExport = [AVAILABLE_CONTRACTS[contractName]];
    console.log(`\n导出单个合约: ${contractName}`);
  } else {
    // 导出所有合约
    contractsToExport = Object.values(AVAILABLE_CONTRACTS);
    console.log(`\n导出所有合约 (${contractsToExport.length} 个)`);
  }

  let successCount = 0;
  let failCount = 0;

  contractsToExport.forEach(contract => {
    const success = exportABI(contract.name, contract.path, contract.output);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  });

  console.log("\n========================================");
  console.log("导出完成");
  console.log("========================================");
  console.log(`✓ 成功: ${successCount}`);
  if (failCount > 0) {
    console.log(`❌ 失败: ${failCount}`);
  }
  console.log("========================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

main();
