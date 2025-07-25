import { rule } from "graphql-shield";
import { setUserDataOnContext } from "./userDataHelperFunctions.js";
import { channelHasZeroAdmins } from "./channelHasZeroAdmins.js";

type CanBecomeForumAdminArgs = {
  channelUniqueName: string;
};

export const canBecomeForumAdmin = rule({ cache: "contextual" })(
  async (parent: any, args: CanBecomeForumAdminArgs, context: any, info: any) => {
    const { channelUniqueName } = args;

    if (!channelUniqueName) {
      throw new Error("channelUniqueName is required");
    }

    // Check if user is authenticated
    context.user = await setUserDataOnContext({
      context,
      getPermissionInfo: false,
    });

    if (!context.user?.username) {
      throw new Error("User must be authenticated");
    }

    // Check if the channel has zero admins
    const hasZeroAdmins = await channelHasZeroAdmins({
      channelName: channelUniqueName,
      context,
    });

    if (!hasZeroAdmins) {
      throw new Error("Cannot become admin: this forum already has one or more admins");
    }

    return true;
  }
);