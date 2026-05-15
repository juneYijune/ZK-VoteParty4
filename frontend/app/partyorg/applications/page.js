"use client";

import { PartyOrgLayout } from "@/components";
import { MemberApplications } from "@/modules/partyOrg";

export default function ApplicationsPage() {
  return (
    <PartyOrgLayout>
      <MemberApplications />
    </PartyOrgLayout>
  );
}
