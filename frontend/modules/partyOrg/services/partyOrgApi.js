import { backendGet } from "@/services/backend";

export async function listPartyOrgs() {
  return backendGet("/api/party-orgs/list");
}
