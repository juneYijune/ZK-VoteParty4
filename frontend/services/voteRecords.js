import { getFrontendEnv } from "@/lib/env";

// 获取后端基础URL
function getBackendBaseUrl() {
  const { backendBaseUrl } = getFrontendEnv();
  if (!backendBaseUrl) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL 未配置");
  return backendBaseUrl;
}

// 记录投票到数据库
export async function recordVote(payload) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/vote-records/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 获取我的投票记录列表
export async function myVoteRecords({ user_address, page, pageSize } = {}) {
  const base = getBackendBaseUrl();

  const params = new URLSearchParams();
  if (user_address) params.set("user_address", String(user_address));
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));

  const qs = params.toString();
  const res = await fetch(`${base}/api/vote-records/my-list${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 检查是否已投票
export async function votedStatus({ vote_id, user_address } = {}) {
  const base = getBackendBaseUrl();

  const params = new URLSearchParams();
  if (vote_id) params.set("vote_id", String(vote_id));
  if (user_address) params.set("user_address", String(user_address));

  const qs = params.toString();
  const res = await fetch(`${base}/api/vote-records/voted${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// 获取投票记录详情
export async function getVoteRecordDetail(recordId) {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/vote-records/detail/${recordId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}
