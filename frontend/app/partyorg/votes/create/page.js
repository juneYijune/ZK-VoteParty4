"use client";

import { PartyOrgLayout } from "@/components";
import { PartyOrgDashboard } from "@/modules/partyOrg";

export default function PartyOrgVotesCreatePage() {
  return (
    <PartyOrgLayout>
      <PartyOrgDashboard mode="create" />
    </PartyOrgLayout>
  );
}
