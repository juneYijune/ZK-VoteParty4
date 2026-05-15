"use client";

import { PartyOrgLayout } from "@/components";
import { PartyOrgDashboard } from "@/modules/partyOrg";

export default function PartyOrgVotesPage() {
  return (
    <PartyOrgLayout>
      <PartyOrgDashboard mode="my" />
    </PartyOrgLayout>
  );
}
