"use server";

import { clerkClient, currentUser } from "@clerk/nextjs/server";
import prismadb from "./db";
import { redirect } from "next/navigation";
import { User } from "@prisma/client";
import { connect } from "http2";

export const getAuthUserDetails = async () => {
  const user = await currentUser();

  if (!user) return;

  const userData = await prismadb.user.findUnique({
    where: {
      email: user.emailAddresses[0].emailAddress,
    },
    include: {
      Agency: {
        include: {
          SidebarOption: true,
          SubAccount: {
            include: {
              SidebarOption: true,
            },
          },
        },
      },
      Permissions: true,
    },
  });

  return userData;
};

const saveActivityLogsNotification = async ({
  agencyId,
  description,
  subAccountId,
}: {
  agencyId: string;
  description: string;
  subAccountId?: string;
}) => {
  const authUser = await currentUser();
  let userData;

  if (!authUser) {
    const response = await prismadb.user.findFirst({
      where: { Agency: { SubAccount: { some: { id: subAccountId } } } },
    });

    if (response) userData = response;
  } else {
    userData = await prismadb.user.findUnique({
      where: { email: authUser?.emailAddresses[0].emailAddress },
    });
  }

  if (!userData) {
    console.log("Could not find a user");
    return;
  }

  let foundAgencyId = agencyId;
  if (!foundAgencyId) {
    if (!subAccountId) {
      throw new Error(
        "You need to provide at least an agency Id or a subaccount Id"
      );
    }

    const response = await prismadb.subAccount.findUnique({
      where: { id: subAccountId },
    });

    if (response) foundAgencyId = response.agencyId;
  }
  if (subAccountId) {
    await prismadb.notification.create({
      data: {
        notification: `${userData.name} | ${description}`,
        User: { connect: { id: userData.id } },
        Agency: { connect: { id: foundAgencyId } },
        SubAccount: { connect: { id: subAccountId } },
      },
    });
  } else {
    await prismadb.notification.create({
      data: {
        notification: `${userData.name} | ${description}`,
        User: { connect: { id: userData.id } },
        Agency: { connect: { id: foundAgencyId } },
      },
    });
  }
};

const createTeamUser = async (agencyId: string, user: User) => {
  if (user.role === "AGENCY_OWNER") return null;

  const response = await prismadb.user.create({ data: { ...user } });

  return response;
};

export const verifyAndAcceptInvitation = async () => {
  const user = await currentUser();

  if (!user) return redirect("/sign-in");

  const invitationExists = await prismadb.invitation.findUnique({
    where: {
      email: user.emailAddresses[0].emailAddress,
      status: "PENDING",
    },
  });

  if (invitationExists) {
    const userDetails = await createTeamUser(invitationExists.agencyId, {
      email: invitationExists.email,
      agencyId: invitationExists.agencyId,
      avatarUrl: user.imageUrl,
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: invitationExists.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await saveActivityLogsNotification({
      agencyId: invitationExists.agencyId,
      description: "Joined",
      subAccountId: undefined,
    });

    if (userDetails) {
      await clerkClient.users.updateUserMetadata(user.id, {
        privateMetadata: {
          role: userDetails.role || "SUBACCOUNT_USER",
        },
      });
      await prismadb.invitation.delete({ where: { email: userDetails.email } });
      return userDetails.agencyId;
    } else return null;
  } else {
    const agency = await prismadb.user.findUnique({
      where: { email: user.emailAddresses[0].emailAddress },
    });
    return agency ? agency.id : null;
  }
};
