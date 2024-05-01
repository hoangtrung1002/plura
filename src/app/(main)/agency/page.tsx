import { getAuthUserDetails, verifyAndAcceptInvitation } from "@/lib/queries";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import React from "react";

const AgencyPate = async () => {
  const agencyId = await verifyAndAcceptInvitation();

  //get user details
  const userData = await getAuthUserDetails();

  return <div>AgencyPate</div>;
};

export default AgencyPate;
