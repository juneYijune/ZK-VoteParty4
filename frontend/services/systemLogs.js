import { getFrontendEnv } from "@/lib/env";

function getBackendBaseUrl() {
  const { backendBaseUrl } = getFrontendEnv();
  if (!backendBaseUrl) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL 未配置");
  return backendBaseUrl;
}

// 获取系统日志列表
export async function listSystemLogs(params = {}) {
  const base = getBackendBaseUrl();

  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", String(params.page));
  if (params.pageSize) queryParams.set("pageSize", String(params.pageSize));
  if (params.log_type && params.log_type !== "all") queryParams.set("log_type", String(params.log_type));
  if (params.operator_address) queryParams.set("operator_address", String(params.operator_address));
  if (params.start_date) queryParams.set("start_date", String(params.start_date));
  if (params.end_date) queryParams.set("end_date", String(params.end_date));

  const qs = queryParams.toString();
  const res = await fetch(`${base}/api/system-logs/list${qs ? `?${qs}` : ""}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.data || {};
}

// 获取日志统计信息
export async function getLogStatistics() {
  const base = getBackendBaseUrl();

  const res = await fetch(`${base}/api/system-logs/statistics`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.data || {};
}
