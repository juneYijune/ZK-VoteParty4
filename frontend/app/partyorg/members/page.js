"use client";

import { PartyOrgLayout } from "@/components";
import { OrgMembers } from "@/modules/partyOrg";

export default function OrgMembersPage() {
  return (
    <PartyOrgLayout>
      <OrgMembers />
    </PartyOrgLayout>
  );
}
