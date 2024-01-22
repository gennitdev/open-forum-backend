import { setUserDataOnContext } from "./userDataHelperFunctions.js";
import { ERROR_MESSAGES } from "./errorMessages.js";
import { ServerModPermissionChecks } from "./hasChannelPermission.js";


// The moderation profile has these fields:

// ModChannelRoles: [ModChannelRole!]!
//       @relationship(type: "HAS_MOD_ROLE", direction: OUT)
//     ModServerRoles: [ModServerRole!]! @relationship(type: "HAS_MOD_ROLE", direction: OUT)

export const hasServerModPermission: (
  permission: string,
  context: any
) => Promise<Error | boolean> = async (permission, context) => {

  // 1. Check for server roles on the user object.
  context.user = await setUserDataOnContext({
    context,
    getPermissionInfo: true,
  });
  console.log("mod profile", context.user?.ModerationProfile)
  const modServerRoles = context.user?.ModerationProfile?.ModServerRoles || [];

  // 2. If there is at least one mod role on the user
  //    object, loop over them. All of them must explicitly
  //    allow the permission. Otherwise, if one says false
  //    or is noggggt mentioned, return false.
  if (modServerRoles.length > 0) {
    for (const modServerRole of modServerRoles) {
      if (!modServerRole[permission]) {
        return new Error(ERROR_MESSAGES.server.noServerPermission);
      }
    }
  }

  // 3. If there are no server roles on the user object,
  //    get the default server role. This is located on the
  //    ServerConfig object.
  const ServerConfig = context.ogm.model("ServerConfig");
  const serverConfig = await ServerConfig.find({
    where: { serverName: process.env.SERVER_CONFIG_NAME },
    selectionSet: `{ 
      DefaultModRole { 
        canOpenSupportTickets
        canLockChannel
        canCloseSupportTickets
        canGiveFeedback
      } 
    }`,
  });
  console.log('server config', serverConfig)

  if (!serverConfig || !serverConfig[0]) {
    return new Error(
      "Could not find the server config, which contains the default server mod role. Therefore could not check the user's permissions."
    );
  }

  const defaultServerModRole = serverConfig[0]?.DefaultModRole;

  if (!defaultServerModRole) {
    return new Error("Could not find the default server mod role.");
  }

  modServerRoles.push(serverConfig[0]?.DefaultModRole);

  // Error handling: Make sure we could successfully fetch the
  // default server role. If not, return an error.
  if (!modServerRoles[0]) {
    return new Error(
      "Could not find permission on user's mod profile roles or on the default server mod role."
    );
  }

  // 3. Check if the permission is allowed by the default
  //    server role.
  const serverRoleToCheck = modServerRoles[0];
  if (permission === ServerModPermissionChecks.GIVE_FEEDBACK) {
    return serverRoleToCheck.canGiveFeedback;
  }
  return new Error(ERROR_MESSAGES.channel.noChannelPermission);
};
