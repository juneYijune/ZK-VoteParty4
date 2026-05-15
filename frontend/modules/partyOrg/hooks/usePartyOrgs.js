import { useEffect, useState } from "react";
import { listPartyOrgs } from "../services/partyOrgApi";

export function usePartyOrgs() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listPartyOrgs().then(setData).catch((e) => setError(e?.message || String(e)));
  }, []);

  return { data, error };
}
