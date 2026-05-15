"use client";

import { AdminLayout } from "@/components";
import { AdminMembers } from "@/modules/admin";

export default function AdminMembersPage() {
  return (
    <AdminLayout>
      <AdminMembers />
    </AdminLayout>
  );
}
