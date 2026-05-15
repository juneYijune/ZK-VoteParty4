import { getFrontendEnv } from "@/lib/env";

function getBackendBaseUrl() {
  const { backendBaseUrl } = getFrontendEnv();
  if (!backendBaseUrl) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL 未配置");
  return backendBaseUrl;
}

export async function listVoteActions({ keyword, status, party_org_id, page, pageSize } = {}) {
  const base = getBackendBaseUrl();

  const params = new URLSearchParams();
  if (keyword) params.set("keyword", String(keyword));
  if (status !== undefined && status !== null && status !== "") params.set("status", String(status));
  if (party_org_id !== undefined && party_org_id !== null && party_org_id !== "") {
    params.set("party_org_id", String(party_org_id));
  }
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));

  const qs = params.toString();
  const res = await fetch(`${base}/api/voteAction/list${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function getVoteDetail(vote_id) {
  const base = getBackendBaseUrl();
  const vid = String(vote_id || "").trim();
  if (!vid) throw new Error("vote_id is required");

  const res = await fetch(`${base}/api/voteAction/detail/${encodeURIComponent(vid)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function updateVoteActionStatus(payload) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/voteAction/update-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export async function addVoteActionDb(payload) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/voteAction/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}
