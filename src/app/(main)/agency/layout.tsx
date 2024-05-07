import SideBar from "@/components/Sidebar";
import Unauthorized from "@/components/unauthorized";
import {
  getNotificationAndUser,
  verifyAndAcceptInvitation,
} from "@/lib/queries";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import React from "react";

type Props = {
  children: React.ReactNode;
  params: { agencyId: string };
};

const layout = async ({ children, params }: Props) => {
  const agencyId = await verifyAndAcceptInvitation();
  const user = await currentUser();

  if (!user) return redirect("/");

  if (!agencyId) return redirect("/agency");

  if (
    user.privateMetadata.role !== Role.AGENCY_OWNER &&
    user.privateMetadata.role !== Role.AGENCY_ADMIN
  )
    return <Unauthorized />;

  let allNoti: any = [];
  const notifications = await getNotificationAndUser(agencyId);
  if (notifications) allNoti = notifications;

  return (
    <div className="h-screen overflow-hidden">
      <SideBar id={params.agencyId} type="agency" />
      <div className="md:pl-[300px]">{children}</div>
    </div>
  );
};

export default layout;
