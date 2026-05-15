import { useEffect, useState } from "react";
import { getAdminInfo } from "../services/adminApi";

export function useAdminInfo() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminInfo().then(setData).catch((e) => setError(e?.message || String(e)));
  }, []);

  return { data, error };
}
