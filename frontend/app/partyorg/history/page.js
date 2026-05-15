"use client";

import { PartyOrgLayout } from "@/components";
import { VoteHistory } from "@/modules/partyOrg";

export default function PartyOrgHistoryPage() {
  return (
    <PartyOrgLayout>
      <VoteHistory />
    </PartyOrgLayout>
  );
}
