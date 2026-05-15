const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const network = await hre.ethers.provider.getNetwork();

  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Network:", network.name, "chainId=", network.chainId.toString());

  const PartyVoting = await hre.ethers.getContractFactory("PartyVoting");
  const partyVoting = await PartyVoting.deploy();
  await partyVoting.waitForDeployment();

  const address = await partyVoting.getAddress();
  console.log("PartyVoting deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
