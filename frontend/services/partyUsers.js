import { getFrontendEnv } from "@/lib/env";

function getBackendBaseUrl() {
  const { backendBaseUrl } = getFrontendEnv();
  if (!backendBaseUrl) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL 未配置");
  return backendBaseUrl;
}

// 获取当前用户的党组织信息
export async function getMyPartyOrg(walletAddress) {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/party-users/my-party-org?wallet_address=${encodeURIComponent(walletAddress)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 计算钱包地址的 Poseidon Hash
export async function hashWalletAddress(walletAddress) {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/party-users/hash-wallet-address`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 申请加入党组织
export async function applyToJoinPartyOrg(payload) {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/party-users/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 获取申请列表（党组织管理员）
export async function listApplications(params) {
  const base = getBackendBaseUrl();
  const queryParams = new URLSearchParams();
  if (params.org_id) queryParams.set("org_id", String(params.org_id));
  if (params.page) queryParams.set("page", String(params.page));
  if (params.pageSize) queryParams.set("pageSize", String(params.pageSize));

  const qs = queryParams.toString();
  const res = await fetch(`${base}/api/party-users/applications${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 审批申请
export async function approveApplication(payload) {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/party-users/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 获取成员列表（党组织管理员）
export async function listMembers(params) {
  const base = getBackendBaseUrl();
  const queryParams = new URLSearchParams();
  if (params.org_id) queryParams.set("org_id", String(params.org_id));
  if (params.page) queryParams.set("page", String(params.page));
  if (params.pageSize) queryParams.set("pageSize", String(params.pageSize));

  const qs = queryParams.toString();
  const res = await fetch(`${base}/api/party-users/members${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 迁出党组织（删除成员）
export async function removeMember(payload) {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/party-users/remove-member`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}
