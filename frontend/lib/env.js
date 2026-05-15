export function getFrontendEnv() {
  const runtimeEnv =
    typeof window !== "undefined" && window.__APP_ENV__ ? window.__APP_ENV__ : {};

  return {
    backendBaseUrl:
      runtimeEnv.NEXT_PUBLIC_BACKEND_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
      "",
    chainId:
      runtimeEnv.NEXT_PUBLIC_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || "",
    partyVotingAddress:
      runtimeEnv.NEXT_PUBLIC_PARTY_VOTING_ADDRESS ||
      process.env.NEXT_PUBLIC_PARTY_VOTING_ADDRESS ||
      "",
    votingVerifierAddress:
      runtimeEnv.NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS ||
      process.env.NEXT_PUBLIC_VOTING_VERIFIER_ADDRESS ||
      ""
  };
}
