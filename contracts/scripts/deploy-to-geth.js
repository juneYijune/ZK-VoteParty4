const hre = require("hardhat");

async function main() {
  console.log("开始部署到 Geth 私链...\n");

  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);

  // 获取账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "ETH\n");

  // 1. 部署 PartyVoting 合约
  console.log("1. 部署 PartyVoting 合约...");
  const PartyVoting = await hre.ethers.getContractFactory("PartyVoting");
  const partyVoting = await PartyVoting.deploy();
  await partyVoting.waitForDeployment();
  const partyVotingAddress = await partyVoting.getAddress();
  console.log("✓ PartyVoting 部署成功:", partyVotingAddress);

  // 2. 部署 Groth16Verifier 合约
  console.log("\n2. 部署 Groth16Verifier 合约...");
  const Groth16Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Groth16Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("✓ Groth16Verifier 部署成功:", verifierAddress);

  // 3. 部署 VotingEligibilityVerifier 合约
  console.log("\n3. 部署 VotingEligibilityVerifier 合约...");
  const VotingEligibilityVerifier = await hre.ethers.getContractFactory("VotingEligibilityVerifier");
  const eligibilityVerifier = await VotingEligibilityVerifier.deploy();
  await eligibilityVerifier.waitForDeployment();
  const eligibilityVerifierAddress = await eligibilityVerifier.getAddress();
  console.log("✓ VotingEligibilityVerifier 部署成功:", eligibilityVerifierAddress);

  // 4. 设置 Verifier 合约地址
  console.log("\n4. 设置 Verifier 合约地址...");
  const tx = await eligibilityVerifier.setVerifierContract(verifierAddress);
  await tx.wait();
  console.log("✓ Verifier 地址设置成功");

  // 输出部署信息
  console.log("\n" + "=".repeat(60));
  console.log("部署完成!");
  console.log("=".repeat(60));
  console.log("\n合约地址:");
  console.log("- PartyVoting:", partyVotingAddress);
  console.log("- Groth16Verifier:", verifierAddress);
  console.log("- VotingEligibilityVerifier:", eligibilityVerifierAddress);
  console.log("\n部署账户 (Admin):", deployer.address);
  
  console.log("\n请更新以下配置文件:");
  console.log("1. frontend/.env.local");
  console.log("   NEXT_PUBLIC_PARTY_VOTING_ADDRESS=" + partyVotingAddress);
  console.log("   NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS=" + eligibilityVerifierAddress);
  console.log("   NEXT_PUBLIC_CHAIN_ID=1337");
  console.log("\n2. backend/.env");
  console.log("   PARTY_VOTING_ADDRESS=" + partyVotingAddress);
  console.log("   VOTING_VERIFIER_ADDRESS=" + eligibilityVerifierAddress);
  console.log("   BLOCKCHAIN_RPC_URL=http://127.0.0.1:8558");
  console.log("   CHAIN_ID=1337");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
