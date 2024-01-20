import { setUserDataOnContext } from "./userDataHelperFunctions.js";
import { ERROR_MESSAGES } from "./errorMessages.js";
import { ChannelModel } from "../ogm-types.js";

export const ChannelPermissionChecks = {
  CREATE_EVENT: "createEvent",
  CREATE_DISCUSSION: "createDiscussion",
  CREATE_COMMENT: "createComment",
  UPDATE_EVENT: "updateEvent",
  UPDATE_DISCUSSION: "updateDiscussion",
  UPDATE_COMMENT: "updateComment",
};

type HasChannelPermissionInput = {
  permission: string;
  channelName: string;
  context: any;
  Channel: ChannelModel;
};

export const hasChannelPermission: (
  input: HasChannelPermissionInput
) => Promise<Error | boolean> = async (input: HasChannelPermissionInput) => {
  const { permission, channelName, context, Channel } = input;
  console.log("has channel permission rule is running");
  // example of channel permission is CreateEvents.

  // 1. Check for server roles on the user object.
  context.user = await setUserDataOnContext({
    context,
    getPermissionInfo: true,
    checkSpecificChannel: channelName,
  });

  console.log("set user data on context. user data is ", context.user);

  const usersServerRoles = context.user?.data?.ServerRoles || [];

  // 2. If there is at least one server role on the user
  //    object, loop over them. All of them must explicitly
  //    allow the permission. Otherwise, if one says false
  //    or is not mentioned, return false.
  if (usersServerRoles.length > 0) {
    for (const serverRole of usersServerRoles) {
      if (!serverRole[permission]) {
        // We check if the user has been suspended
        // from the server and reject the request if so.
        console.log(
          `The user has a server role that does not allow the action ${permission}`,
          permission,
          serverRole
        );
        return new Error(ERROR_MESSAGES.server.noServerPermission);
      }
    }
  }

  // 3. Check the user's channel roles.
  // Get the list of channel roles on the user object.
  const channelRoles = context.user?.data?.ChannelRoles || [];

  console.log("channel roles are ", channelRoles);

  if (channelRoles.length > 0) {
    for (const channelRole of channelRoles) {
      if (!channelRole[permission]) {
        // We check if the user has been suspended
        // from the channel and reject the request if so.
        console.log(
          `The user has a channel role that does not allow the action ${permission}`,
          permission,
          channelRole
        );
        return new Error(ERROR_MESSAGES.server.noServerPermission);
      }
    }
  }

  console.log("users server roles are ", usersServerRoles);

  // 4. If there are no channel roles on the user object,
  // get the default channel role. This is located on the
  // Channel object.
  // We will allow the action only if the action is allowed
  // by the default channel role AND the default server role.
  if (!channelRoles.length) {
    const channel = await Channel.find({
      where: {
        uniqueName: channelName,
      },
      selectionSet: `{ 
            DefaultChannelRole { 
              canCreateEvent
              canCreateDiscussion
              canCreateComment
            } 
          }`,
    });

    // @ts-ignore
    const defaultChannelRole = channel[0]?.DefaultChannelRole;

    if (defaultChannelRole) {
      channelRoles.push(defaultChannelRole);
    }

    console.log("default channel role is ", defaultChannelRole);
  }

  // Loop over the list of channel roles. They all
  // must explicitly allow the permission.
  // Otherwise, if one says false or is missing
  // the permission, return false.
  for (const channelRole of channelRoles) {
    if (!channelRole.includes(permission)) {
      return false;
    }
  }

  // 5. We check if the user has been suspended
  // from the server and reject the request if so.

  console.log("Getting the default server role.");
  const ServerConfig = context.ogm.model("ServerConfig");

  console.log("getting server config where:", {
    where: { serverName: process.env.SERVER_CONFIG_NAME },
  });
  const serverConfig = await ServerConfig.find({
    where: { serverName: process.env.SERVER_CONFIG_NAME },
    selectionSet: `{ DefaultServerRole { 
        canCreateChannel
        canCreateEvent
        canCreateDiscussion
        canCreateComment
      } 
    }`,
  });

  if (!serverConfig || !serverConfig[0]) {
    return new Error(
      "Could not find the server config, which contains the default server role. Therefore could not check the user's permissions."
    );
  }

  console.log("server config is ", serverConfig);

  const defaultServerRole = serverConfig[0]?.DefaultServerRole;

  if (!defaultServerRole) {
    return new Error("Could not find the default server role.");
  }

  console.log("Checking the default server role", defaultServerRole);

  usersServerRoles.push(defaultServerRole);

  // Error handling: Make sure we could successfully fetch the
  // default server role. If not, return an error.
  if (!usersServerRoles[0]) {
    return new Error(
      "Could not find permission on user's role or on the default server role."
    );
  }

  // Check if the permission is allowed by the default
  //    server role.
  const serverRoleToCheck = usersServerRoles[0];

  if (permission === ChannelPermissionChecks.CREATE_DISCUSSION) {
    console.log("checking if the default server role can create discussions");
    return !!serverRoleToCheck.canCreateDiscussion;
  }
  if (permission === ChannelPermissionChecks.CREATE_EVENT) {
    console.log("checking if the default server role can create events");
    return !!serverRoleToCheck.canCreateEvent;
  }
  if (permission === ChannelPermissionChecks.CREATE_COMMENT) {
    console.log("checking if the default server role can create comments");
    console.log("server role to check is ", serverRoleToCheck);
    console.log("can create comment is ", serverRoleToCheck.canCreateComment);
    return !!serverRoleToCheck.canCreateComment;
  }
  console.log("The action is not allowed by the default server role.");
  return new Error(ERROR_MESSAGES.generic.noPermission);
};

type CheckChannelPermissionInput = {
  channelConnections: string[];
  context: any;
  permissionCheck: string;
};


// Helper function to check channel permissions
export async function checkChannelPermissions(
  input: CheckChannelPermissionInput
) {
  const { channelConnections, context, permissionCheck } = input;
  const channelModel = context.ogm.model("Channel");

  console.log('checking permissions for channel connections ', channelConnections)

  for (const channelConnection of channelConnections) {
    const permissionResult = await hasChannelPermission({
      permission: permissionCheck,
      channelName: channelConnection,
      context: context,
      Channel: channelModel,
    });

    if (!permissionResult) {
      console.log(`The user does not have permission in this channel: ${channelConnection}`);
      return new Error("The user does not have permission in this channel.");
    }

    if (permissionResult instanceof Error) {
      console.log("Permission check returned error", permissionResult.message);
      return permissionResult;
    }
  }

  return true;
}