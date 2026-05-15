const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("开始部署投票资格验证器合约...");

  // 1. 部署 EligibleVoterVerifier 合约（由 snarkjs 生成）
  console.log("\n1. 部署 ZK 验证器合约...");
  
  const verifierPath = path.join(__dirname, "../contracts/EligibleVoterVerifier.sol");
  if (!fs.existsSync(verifierPath)) {
    console.error("错误: EligibleVoterVerifier.sol 不存在");
    console.log("请先运行: cd ZKcircuits && npm run generate-verifier");
    console.log("然后将生成的合约复制到 contracts/contracts/ 目录");
    process.exit(1);
  }

  const EligibleVoterVerifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const eligibleVoterVerifier = await EligibleVoterVerifier.deploy();
  await eligibleVoterVerifier.waitForDeployment();
  const verifierAddress = await eligibleVoterVerifier.getAddress();
  
  console.log("✓ ZK 验证器合约已部署:", verifierAddress);

  // 2. 部署 VotingEligibilityVerifier 合约
  console.log("\n2. 部署投票资格验证器合约...");
  
  const VotingEligibilityVerifier = await hre.ethers.getContractFactory("VotingEligibilityVerifier");
  const votingEligibilityVerifier = await VotingEligibilityVerifier.deploy();
  await votingEligibilityVerifier.waitForDeployment();
  const votingVerifierAddress = await votingEligibilityVerifier.getAddress();
  
  console.log("✓ 投票资格验证器合约已部署:", votingVerifierAddress);

  // 3. 设置验证器合约地址
  console.log("\n3. 配置验证器合约地址...");
  
  const tx = await votingEligibilityVerifier.setVerifierContract(verifierAddress);
  await tx.wait();
  
  console.log("✓ 验证器合约地址已配置");

  // 4. 保存部署信息
  console.log("\n4. 保存部署信息...");
  
  const deploymentInfo = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    contracts: {
      EligibleVoterVerifier: verifierAddress,
      VotingEligibilityVerifier: votingVerifierAddress
    }
  };

  const deploymentPath = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentPath, `verifier-${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("✓ 部署信息已保存到:", `deployments/verifier-${hre.network.name}.json`);

  // 5. 导出 ABI 到前端
  console.log("\n5. 导出 ABI 到前端...");
  
  const votingVerifierArtifact = await hre.artifacts.readArtifact("VotingEligibilityVerifier");
  const frontendContractsPath = path.join(__dirname, "../../frontend/contracts");
  
  if (!fs.existsSync(frontendContractsPath)) {
    fs.mkdirSync(frontendContractsPath, { recursive: true });
  }

  // 导出 ABI
  fs.writeFileSync(
    path.join(frontendContractsPath, "VotingEligibilityVerifier.abi.js"),
    `export default ${JSON.stringify(votingVerifierArtifact.abi, null, 2)};`
  );

  // 导出合约配置
  fs.writeFileSync(
    path.join(frontendContractsPath, "votingEligibilityVerifier.js"),
    `import VotingEligibilityVerifierAbi from "./VotingEligibilityVerifier.abi";

export const VotingEligibilityVerifierContract = {
  address: "${votingVerifierAddress}",
  abi: VotingEligibilityVerifierAbi
};
`
  );

  console.log("✓ ABI 已导出到前端");

  console.log("\n========================================");
  console.log("部署完成！");
  console.log("========================================");
  console.log("\n合约地址:");
  console.log("- ZK 验证器:", verifierAddress);
  console.log("- 投票资格验证器:", votingVerifierAddress);
  console.log("\n请将以下地址添加到前端 .env.local 文件:");
  console.log(`NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS=${votingVerifierAddress}`);
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
