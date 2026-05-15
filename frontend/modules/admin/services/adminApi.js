import { backendGet } from "@/services/backend";

export async function getAdminInfo() {
  return backendGet("/api/admin");
}
