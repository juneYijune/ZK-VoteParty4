import PartyVotingAbi from "./PartyVoting.abi";
import { getFrontendEnv } from "@/lib/env";

export const PartyVotingContract = {
  address: getFrontendEnv().partyVotingAddress || "",
  abi: PartyVotingAbi
};
