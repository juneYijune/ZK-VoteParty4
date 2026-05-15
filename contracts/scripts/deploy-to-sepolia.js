const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("开始部署到 Sepolia 测试网络...");
  
  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  
  // 检查账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    console.error("❌ 账户余额为0，请先获取测试ETH");
    console.log("获取测试ETH: https://sepoliafaucet.com/");
    process.exit(1);
  }

  // 1. 部署 PartyVoting 合约
  console.log("\n1. 部署 PartyVoting 合约...");
  const PartyVoting = await hre.ethers.getContractFactory("PartyVoting");
  const partyVoting = await PartyVoting.deploy();
  await partyVoting.waitForDeployment();
  const partyVotingAddress = await partyVoting.getAddress();
  console.log("✅ PartyVoting 部署成功:", partyVotingAddress);

  // 2. 部署 Groth16Verifier 合约
  console.log("\n2. 部署 Groth16Verifier 合约...");
  const Groth16Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Groth16Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("✅ Groth16Verifier 部署成功:", verifierAddress);

  // 3. 部署 VotingEligibilityVerifier 合约
  console.log("\n3. 部署 VotingEligibilityVerifier 合约...");
  const VotingEligibilityVerifier = await hre.ethers.getContractFactory("VotingEligibilityVerifier");
  const eligibilityVerifier = await VotingEligibilityVerifier.deploy();
  await eligibilityVerifier.waitForDeployment();
  const eligibilityVerifierAddress = await eligibilityVerifier.getAddress();
  console.log("✅ VotingEligibilityVerifier 部署成功:", eligibilityVerifierAddress);

  // 4. 设置 Verifier 合约地址
  console.log("\n4. 设置 Verifier 合约地址...");
  const tx = await eligibilityVerifier.setVerifierContract(verifierAddress);
  await tx.wait();
  console.log("✅ Verifier 地址设置成功");

  // 5. 验证部署
  console.log("\n5. 验证部署...");
  const admin = await partyVoting.getAdmin();
  console.log("系统管理员:", admin);
  console.log("部署账户:", deployer.address);
  console.log("管理员验证:", admin === deployer.address ? "✅ 正确" : "❌ 错误");

  // 6. 导出合约地址到前端
  console.log("\n6. 导出合约地址到前端...");
  const frontendDir = path.join(__dirname, "../../frontend");
  const envPath = path.join(frontendDir, ".env.sepolia");
  
  const envContent = `# Sepolia 测试网络配置
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_PARTY_VOTING_ADDRESS=${partyVotingAddress}
NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS=${eligibilityVerifierAddress}

# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
`;

  fs.writeFileSync(envPath, envContent);
  console.log("✅ 合约地址已导出到:", envPath);

  // 7. 导出合约 ABI
  console.log("\n7. 导出合约 ABI...");
  const partyVotingArtifact = await hre.artifacts.readArtifact("PartyVoting");
  const verifierArtifact = await hre.artifacts.readArtifact("VotingEligibilityVerifier");
  
  const contractsDir = path.join(frontendDir, "contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // 导出 PartyVoting
  const partyVotingPath = path.join(contractsDir, "partyVoting.js");
  const partyVotingContent = `export const PartyVotingContract = {
  address: "${partyVotingAddress}",
  abi: ${JSON.stringify(partyVotingArtifact.abi, null, 2)}
};
`;
  fs.writeFileSync(partyVotingPath, partyVotingContent);
  console.log("✅ PartyVoting ABI 已导出");

  // 导出 VotingEligibilityVerifier
  const verifierPath = path.join(contractsDir, "votingEligibilityVerifier.js");
  const verifierContent = `export const VotingEligibilityVerifierContract = {
  address: "${eligibilityVerifierAddress}",
  abi: ${JSON.stringify(verifierArtifact.abi, null, 2)}
};
`;
  fs.writeFileSync(verifierPath, verifierContent);
  console.log("✅ VotingEligibilityVerifier ABI 已导出");

  // 8. 总结
  console.log("\n" + "=".repeat(60));
  console.log("🎉 部署完成！");
  console.log("=".repeat(60));
  console.log("网络: Sepolia 测试网");
  console.log("Chain ID: 11155111");
  console.log("PartyVoting 地址:", partyVotingAddress);
  console.log("Groth16Verifier 地址:", verifierAddress);
  console.log("VotingEligibilityVerifier 地址:", eligibilityVerifierAddress);
  console.log("系统管理员:", admin);
  console.log("=".repeat(60));
  console.log("\n📝 后续步骤:");
  console.log("1. 复制 frontend/.env.sepolia 为 frontend/.env.local");
  console.log("2. 更新 backend/.env:");
  console.log(`   PARTY_VOTING_ADDRESS=${partyVotingAddress}`);
  console.log(`   VOTING_VERIFIER_ADDRESS=${eligibilityVerifierAddress}`);
  console.log(`   BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/a2c30f22e60f4678aa3d9bc7cdd28e4b`);
  console.log(`   CHAIN_ID=11155111`);
  console.log("3. 在 Etherscan 上验证合约:");
  console.log(`   npx hardhat verify --network sepolia ${partyVotingAddress}`);
  console.log(`   npx hardhat verify --network sepolia ${verifierAddress}`);
  console.log(`   npx hardhat verify --network sepolia ${eligibilityVerifierAddress}`);
  console.log("4. 重启前端和后端应用");
  console.log("5. 使用部署账户登录系统作为管理员");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
