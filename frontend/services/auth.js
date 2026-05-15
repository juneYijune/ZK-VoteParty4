import { getFrontendEnv } from "@/lib/env";

function getBackendBaseUrl() {
  const { backendBaseUrl } = getFrontendEnv();
  if (!backendBaseUrl) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL 未配置");
  return backendBaseUrl;
}

export async function fetchWalletNonce(address) {
  // 中文说明：向后端获取一次性 nonce（防重放），用于 MetaMask 签名
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/auth/wallet/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.nonce;
}

export async function walletLogin(address, signature) {
  // 中文说明：发送签名到后端校验，校验成功后后端会删除 nonce
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/auth/wallet/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}
