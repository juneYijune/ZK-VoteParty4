const hre = require("hardhat");

async function main() {
  console.log("开始部署投票资格验证器合约...\n");

  // 1. 部署 Groth16Verifier 合约（ZK 验证器）
  console.log("1. 部署 ZK 验证器合约 (Groth16Verifier)...");
  const Groth16Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const verifierAddress = await groth16Verifier.getAddress();
  console.log("✓ ZK 验证器合约已部署:", verifierAddress);

  // 2. 部署 VotingEligibilityVerifier 合约
  console.log("\n2. 部署投票资格验证器合约 (VotingEligibilityVerifier)...");
  const VotingEligibilityVerifier = await hre.ethers.getContractFactory("VotingEligibilityVerifier");
  const votingVerifier = await VotingEligibilityVerifier.deploy();
  await votingVerifier.waitForDeployment();
  const votingVerifierAddress = await votingVerifier.getAddress();
  console.log("✓ 投票资格验证器合约已部署:", votingVerifierAddress);

  // 3. 设置验证器合约地址
  console.log("\n3. 配置验证器合约地址...");
  const tx = await votingVerifier.setVerifierContract(verifierAddress);
  await tx.wait();
  console.log("✓ 验证器合约地址已配置");

  // 4. 显示部署信息
  console.log("\n========================================");
  console.log("部署完成！");
  console.log("========================================");
  console.log("\n合约地址:");
  console.log("- ZK 验证器 (Groth16Verifier):", verifierAddress);
  console.log("- 投票资格验证器 (VotingEligibilityVerifier):", votingVerifierAddress);
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
