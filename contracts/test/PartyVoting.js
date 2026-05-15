const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("PartyVoting", function () {
  async function deployFixture() {
    const [admin, partyOrg, voter, other] = await ethers.getSigners();

    const PartyVoting = await ethers.getContractFactory("PartyVoting");
    const partyVoting = await PartyVoting.deploy();

    return { partyVoting, admin, partyOrg, voter, other };
  }

  it("admin should be deployer", async function () {
    const { partyVoting, admin } = await loadFixture(deployFixture);
    expect(await partyVoting.getAdmin()).to.equal(admin.address);
  });

  it("only admin can add party org", async function () {
    const { partyVoting, partyOrg, other } = await loadFixture(deployFixture);

    await expect(partyVoting.connect(other).addPartyOrg(partyOrg.address)).to.be.revertedWith(
      "Only the admin can perform this action"
    );

    await expect(partyVoting.addPartyOrg(partyOrg.address)).not.to.be.reverted;
    expect(await partyVoting.getisPartyOrgAdmin(partyOrg.address)).to.equal(true);
  });

  it("party org can create/start, voter can vote, and results are correct", async function () {
    const { partyVoting, partyOrg, voter } = await loadFixture(deployFixture);

    await partyVoting.addPartyOrg(partyOrg.address);

    const now = await time.latest();
    const startTime = now + 10;
    const endTime = startTime + 3600;

    const options = ["A", "B", "C"];

    await expect(
      partyVoting
        .connect(partyOrg)
        .createVote("test", 0, startTime, endTime, 2, options)
    ).not.to.be.reverted;

    const ids = await partyVoting.getAllVoteIds();
    expect(ids.length).to.equal(1);

    const voteId = ids[0];

    await expect(partyVoting.connect(partyOrg).startVote(voteId)).not.to.be.reverted;

    await time.increaseTo(startTime);

    await expect(partyVoting.connect(voter).vote(voteId, [0, 1])).not.to.be.reverted;

    const result = await partyVoting.getVoteResult(voteId);

    const counts = result[3];
    const totalVotes = result[4];

    expect(counts[0]).to.equal(1);
    expect(counts[1]).to.equal(1);
    expect(counts[2]).to.equal(0);
    expect(totalVotes).to.equal(2);

    await expect(partyVoting.connect(voter).vote(voteId, [0])).to.be.revertedWith(
      "You have already voted"
    );

    await expect(partyVoting.connect(partyOrg).endVote(voteId)).not.to.be.reverted;
  });
});
