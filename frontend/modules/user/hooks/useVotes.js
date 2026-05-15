import { useEffect, useState } from "react";
import { listVotes } from "../services/votesApi";

export function useVotes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listVotes().then(setData).catch((e) => setError(e?.message || String(e)));
  }, []);

  return { data, error };
}
