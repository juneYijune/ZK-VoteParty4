import { backendGet } from "@/services/backend";

export async function listVotes() {
  return backendGet("/api/votes");
}
