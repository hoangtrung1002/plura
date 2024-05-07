import React from "react";
import MenuOptions from "./MenuOptions";
import { getAuthUserDetails } from "@/lib/queries";

type Props = {
  id: string;
  type: "agency" | "subaccount";
};

const SideBar = async ({ id, type }: Props) => {
  const user = await getAuthUserDetails();

  if (!user) return null;

  if (!user.Agency) return;

  const details =
    type === "agency"
      ? user.Agency
      : user.Agency.SubAccount.find((subAccount) => subAccount.id === id);

  const isWhiteLabeledAgency = user.Agency?.whiteLabel;

  if (!details) return;

  let sideBarLogo = user.Agency.agencyLogo || "/assets/plura-logo.svg";

  if (!isWhiteLabeledAgency) {
    if (type === "subaccount") {
      sideBarLogo =
        user.Agency.SubAccount.find((subAccount) => subAccount.id === id)
          ?.subAccountLogo || user.Agency?.agencyLogo;
    }
  }

  const sidebarOpt =
    type === "agency"
      ? user.Agency.SidebarOption || []
      : user.Agency.SubAccount.find((subAccount) => subAccount.id === id)
          ?.SidebarOption || [];

  const subAccounts = user.Agency.SubAccount.filter((subAccount) =>
    user.Permissions.find(
      (permission) =>
        permission.subAccountId === subAccount.id && permission.access
    )
  );
  return (
    <>
      <MenuOptions
        id={id}
        details={details}
        defaultOpen={true}
        sidebarLogo={sideBarLogo}
        sidebarOpt={sidebarOpt}
        subAccounts={subAccounts}
        user={user}
      />
      {/* Mobile navbar */}
      <MenuOptions
        id={id}
        details={details}
        sidebarLogo={sideBarLogo}
        sidebarOpt={sidebarOpt}
        subAccounts={subAccounts}
        user={user}
      />
    </>
  );
};

export default SideBar;
