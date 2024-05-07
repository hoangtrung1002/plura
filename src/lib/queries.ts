"use server";

import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { Agency, User, Role, Plan } from "@prisma/client";
import { redirect } from "next/navigation";
import prismadb from "./db";

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

export const saveActivityLogsNotification = async ({
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
  if (user.role === Role.AGENCY_OWNER) return null;

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
          role: userDetails.role || Role.SUBACCOUNT_USER,
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

export const updateAgencyDetails = async (
  agencyId: string,
  agencyDetails: Partial<Agency>
) => {
  const response = await prismadb.agency.update({
    where: { id: agencyId },
    data: {
      ...agencyDetails,
    },
  });
  return response;
};

export const deleteAgency = async (agencyId: string) => {
  const response = await prismadb.agency.delete({ where: { id: agencyId } });
  return response;
};

export const initUser = async (newUser: Partial<User>) => {
  const user = await currentUser();
  if (!user) return;

  const userData = await prismadb.user.upsert({
    where: { email: user.emailAddresses[0].emailAddress },
    update: newUser,
    create: {
      id: user.id,
      avatarUrl: user.imageUrl,
      email: user.emailAddresses[0].emailAddress,
      name: `${user.firstName} ${user.lastName}`,
      role: newUser.role || Role.SUBACCOUNT_USER,
    },
  });

  await clerkClient.users.updateUserMetadata(user.id, {
    privateMetadata: {
      role: newUser.role || Role.SUBACCOUNT_USER,
    },
  });
  return userData;
};

export const upsertAgency = async (agency: Agency, price?: Plan) => {
  if (!agency.companyEmail) return null;

  try {
    const agencyDetails = await prismadb.agency.upsert({
      where: { id: agency.id },
      update: agency,
      create: {
        users: {
          connect: { email: agency.companyEmail },
        },
        ...agency,
        SidebarOption: {
          create: [
            {
              name: "Dashboard",
              icon: "category",
              link: `/agency/${agency.id}`,
            },
            {
              name: "Launchpad",
              icon: "clipboardIcon",
              link: `/agency/${agency.id}/launchpad`,
            },
            {
              name: "Billing",
              icon: "payment",
              link: `/agency/${agency.id}/billing`,
            },
            {
              name: "Settings",
              icon: "settings",
              link: `/agency/${agency.id}/settings`,
            },
            {
              name: "Sub Accounts",
              icon: "person",
              link: `/agency/${agency.id}/all-subaccounts`,
            },
            {
              name: "Team",
              icon: "shield",
              link: `/agency/${agency.id}/team`,
            },
          ],
        },
      },
    });
    return agencyDetails;
  } catch (error) {
    console.log(error);
  }
};
