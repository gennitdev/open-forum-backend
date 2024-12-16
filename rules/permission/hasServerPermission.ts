import { setUserDataOnContext } from "./userDataHelperFunctions.js";
import { ERROR_MESSAGES } from "../errorMessages.js";
import { ServerRole } from "../../ogm-types.js";

export const hasServerPermission: (
  permission: keyof ServerRole,
  context: any
) => Promise<Error | boolean> = async (permission, context) => {
  // 1. Check for server roles on the user object.
  context.user = await setUserDataOnContext({
    context,
    getPermissionInfo: true,
  });
  const usersServerRoles = context.user?.data?.ServerRoles || [];

  // 2. If there is at least one server role on the user
  //    object, loop over them. All of them must explicitly
  //    allow the permission. Otherwise, if one says false
  //    or is not mentioned, return false.
  if (usersServerRoles.length > 0) {
    for (const serverRole of usersServerRoles) {
      if (!serverRole[permission]) {
        return new Error(ERROR_MESSAGES.server.noServerPermission);
      }
    }
  } else {
    // 3. If there are no server roles on the user object,
    //    get the default server role. This is located on the
    //    ServerConfig object.
    console.log("No server roles on user object. Getting default server role.");
    const ServerConfig = context.ogm.model("ServerConfig");
    const serverConfig = await ServerConfig.find({
      where: { serverName: process.env.SERVER_CONFIG_NAME },
      selectionSet: `{ DefaultServerRole { 
        canCreateChannel
        canUploadFile
      } 
    }`,
    });

    if (!serverConfig || !serverConfig[0]) {
      return new Error(
        "While checking server permissions, could not find the server config, which contains the default server role. Therefore could not check the user's permissions."
      );
    }

    const defaultServerRole = serverConfig[0]?.DefaultServerRole;

    if (!defaultServerRole) {
      return new Error("Could not find the default server role.");
    }

    usersServerRoles.push(serverConfig[0]?.DefaultServerRole);
  }

  // Error handling: Make sure we could successfully fetch the
  // default server role. If not, return an error.
  if (!usersServerRoles[0]) {
    console.log("No default server role found.");
    return new Error(
      "Could not find permission on user's role or on the default server role."
    );
  }

  // 3. Check if the permission is allowed by the default
  //    server role.

  const serverRoleToCheck = usersServerRoles[0];
  if (permission === "canCreateChannel") {
    console.log("Checking if user can create channel");
    return serverRoleToCheck.canCreateChannel;
  }
  if (permission === "canUploadFile") {
    console.log("Checking if user can upload file");
    return serverRoleToCheck.canUploadFile;
  }
  console.log("No permission found");
  return new Error(ERROR_MESSAGES.channel.noChannelPermission);
};
