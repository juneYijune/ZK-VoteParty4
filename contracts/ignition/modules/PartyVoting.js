const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PartyVotingModule", (m) => {
  const partyVoting = m.contract("PartyVoting");
  return { partyVoting };
});
