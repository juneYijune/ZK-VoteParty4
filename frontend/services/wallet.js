export function hasInjectedEthereum() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function getAccounts() {
  if (!hasInjectedEthereum()) return [];
  return window.ethereum.request({ method: "eth_accounts" });
}

export async function connectWallet() {
  if (!hasInjectedEthereum()) throw new Error("No injected wallet");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts?.[0] || "";
}
