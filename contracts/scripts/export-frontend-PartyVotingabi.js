const fs = require("fs");
const path = require("path");

function main() {
  const artifactPath = path.resolve(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "PartyVoting.sol",
    "PartyVoting.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found: ${artifactPath}. Run 'npm run compile' first.`
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const abi = artifact.abi;

  const outFile = path.resolve(
    __dirname,
    "..",
    "..",
    "frontend",
    "contracts",
    "PartyVoting.abi.js"
  );

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `export default ${JSON.stringify(abi, null, 2)};\n`, "utf-8");

  console.log("ABI exported to:", outFile);
}

main();
