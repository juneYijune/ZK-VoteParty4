export async function backendGet(path) {
  const base = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL not set");
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
