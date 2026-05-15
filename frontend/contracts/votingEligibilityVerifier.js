import VotingEligibilityVerifierAbi from "./VotingEligibilityVerifier.abi";
import { getFrontendEnv } from "@/lib/env";

export const VotingEligibilityVerifierContract = {
  address: getFrontendEnv().votingVerifierAddress || "",
  abi: VotingEligibilityVerifierAbi
};
