"use client";

import { UserLayout } from "@/components";
import { MyVCs } from "@/modules/user/components/MyVCs";

export default function MyVCsPage() {
  return (
    <UserLayout>
      <MyVCs />
    </UserLayout>
  );
}
