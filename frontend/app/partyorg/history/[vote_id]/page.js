"use client";

import { useParams } from "next/navigation";
import { PartyOrgLayout } from "@/components";
import { VoteResultDetail } from "@/modules/partyOrg";

export default function VoteResultPage() {
  const params = useParams();
  const voteId = params && params.vote_id;

  return (
    <PartyOrgLayout>
      <VoteResultDetail voteId={voteId} />
    </PartyOrgLayout>
  );
}
