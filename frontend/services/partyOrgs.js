import { getFrontendEnv } from "@/lib/env";

function getBackendBaseUrl() {
  const { backendBaseUrl } = getFrontendEnv();
  if (!backendBaseUrl) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL 未配置");
  return backendBaseUrl;
}

export async function listPartyOrgs({ keyword, status, page, pageSize } = {}) {
  const base = getBackendBaseUrl();

  const params = new URLSearchParams();
  if (keyword) params.set("keyword", String(keyword));
  if (status !== undefined && status !== null && status !== "") params.set("status", String(status));
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));

  const qs = params.toString();
  const res = await fetch(`${base}/api/party-orgs/list${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function revokePartyOrgAdminOffchain(payload) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/party-orgs/revoke-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function updatePartyOrgAdminAddress(payload) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/party-orgs/update-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function updatePartyOrgOffchain(payload) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/party-orgs/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function getPartyOrgDetail(org_id) {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/party-orgs/${org_id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function addPartyOrgDb(payload) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/party-orgs/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function getPartyOrgByAddress(address) {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/party-orgs/by-address/${address}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}
