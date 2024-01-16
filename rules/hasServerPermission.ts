import { setUserDataOnContext } from "./userDataHelperFunctions.js";
import { ERROR_MESSAGES } from "./errorMessages.js";

export const hasServerPermission = async (permission: string, context: any) => {
  console.log(
    "has server permission check is running. checking for permission named ",
    permission
  );

  // 1. Check for server roles on the user object.
  context.user = await setUserDataOnContext({
    context,
    getPermissionInfo: true,
  });
  console.log("set user data on context. user data is ", context.user);
  const usersServerRoles = context.user?.data?.ServerRoles || [];
  console.log("users server roles are ", usersServerRoles);



  // 2. If there is at least one server role on the user
  //    object, loop over them. All of them must explicitly
  //    allow the permission. Otherwise, if one says false
  //    or is not mentioned, return false.
  if (usersServerRoles.length > 0) {
    for (const serverRole of usersServerRoles) {
      if (!serverRole[permission]) {
        console.log(
          "The user has a server role that does not allow this action.",
          permission,
          serverRole
        );
        return new Error(ERROR_MESSAGES.channel.noChannelPermission);
      }
    }
  }

  // 3. If there are no server roles on the user object,
  //    get the default server role. This is located on the
  //    ServerConfig object.
  else {
    console.log("Getting the default server role.");
    const ServerConfig = context.ogm.model("ServerConfig");
    const serverConfig = await ServerConfig.find(
      {
        where: { serverName: process.env.SERVER_CONFIG_NAME },
      },
      `{ DefaultServerRole { 
        canCreateChannels
      } 
    }`
    );

    if (!serverConfig || !serverConfig[0]) {
      return new Error(
        "Could not find the server config, which contains the default server role. Therefore could not check the user's permissions."
      );
    }

    const defaultServerRole = serverConfig[0]?.DefaultServerRole;

    if (!defaultServerRole) {
      return new Error("Could not find the default server role.");
    }

    console.log(
      "Checking the default server role",
      serverConfig[0]?.DefaultServerRole
    );

    usersServerRoles.push(serverConfig[0]?.DefaultServerRole);
  }

  // Error handling: Make sure we could successfully fetch the
  // default server role. If not, return an error.
  if (!usersServerRoles[0]) {
    return new Error(
      "Could not find permission on user's role or on the default server role."
    );
  }

  // 3. Check if the permission is allowed by the default
  //    server role.
  const serverRoleToCheck = usersServerRoles[0];
  console.log(
    "Checking if the default server role can create channels.",
    serverRoleToCheck.canCreateChannel
  );
  if (permission === "createChannel") {
    return serverRoleToCheck.canCreateChannel;
  }
  console.log("The action is not allowed by the default server role.");
  return new Error(ERROR_MESSAGES.channel.noChannelPermission);
};
