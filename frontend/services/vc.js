import { getFrontendEnv } from "@/lib/env";

function getBackendBaseUrl() {
  const { backendBaseUrl } = getFrontendEnv();
  if (!backendBaseUrl) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL 未配置");
  return backendBaseUrl;
}

// 颁发 VC
export async function issueVC(payload) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/vc/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 查询 VC 列表
export async function listVCs({ holder_user_id, holder_wallet_hash, vc_type, vc_status, page, pageSize } = {}) {
  const base = getBackendBaseUrl();

  const params = new URLSearchParams();
  if (holder_user_id !== undefined && holder_user_id !== null && holder_user_id !== "") {
    params.set("holder_user_id", String(holder_user_id));
  }
  if (holder_wallet_hash) params.set("holder_wallet_hash", String(holder_wallet_hash));
  if (vc_type) params.set("vc_type", String(vc_type));
  if (vc_status !== undefined && vc_status !== null && vc_status !== "") {
    params.set("vc_status", String(vc_status));
  }
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));

  const qs = params.toString();
  const res = await fetch(`${base}/api/vc/list${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 获取 VC 详情
export async function getVCDetail(vc_id) {
  const base = getBackendBaseUrl();
  const vid = String(vc_id || "").trim();
  if (!vid) throw new Error("vc_id is required");

  const res = await fetch(`${base}/api/vc/detail/${encodeURIComponent(vid)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 撤销 VC
export async function revokeVC(vc_id) {
  const base = getBackendBaseUrl();
  const vid = String(vc_id || "").trim();
  if (!vid) throw new Error("vc_id is required");

  const res = await fetch(`${base}/api/vc/revoke/${encodeURIComponent(vid)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 更新 VC
export async function updateVC(vc_id, payload) {
  const base = getBackendBaseUrl();
  const vid = String(vc_id || "").trim();
  if (!vid) throw new Error("vc_id is required");

  const res = await fetch(`${base}/api/vc/update/${encodeURIComponent(vid)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 验证 VC 签名
export async function verifyVCSignature(vc_id) {
  const base = getBackendBaseUrl();
  const vid = String(vc_id || "").trim();
  if (!vid) throw new Error("vc_id is required");

  const res = await fetch(`${base}/api/vc/verify/${encodeURIComponent(vid)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 获取用户的有效VC列表（用于ZK验证）
export async function getMyValidVCs(walletAddress) {
  const base = getBackendBaseUrl();
  
  if (!walletAddress) {
    throw new Error("wallet_address is required");
  }

  const res = await fetch(`${base}/api/vc/my-valid-vcs`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Wallet-Address": walletAddress,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  
  return data.data || [];
}
