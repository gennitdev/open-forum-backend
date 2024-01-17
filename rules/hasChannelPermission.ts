import { rule } from "graphql-shield";
import { setUserDataOnContext } from "./userDataHelperFunctions.js"
import { ERROR_MESSAGES } from "./errorMessages.js";
import { ChannelModel } from "../ogm-types.js";

type Args = {
  permission: string;
  Channel: ChannelModel;
  channelName: string;
};

export const hasChannelPermission = rule({ cache: "contextual" })(
  async (parent: any, args: Args, context: any, info: any) => {
    // example of channel permission is CreateEvents.
    const { permission, Channel, channelName } = args;

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
    const serverConfig = await ServerConfig.find(
      {
        where: { serverName: process.env.SERVER_CONFIG_NAME },
      },
      `{ DefaultServerRole { 
              canCreateChannel
              canCreateDiscussion
              canCreateEvent
              canCreateComment
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
      defaultServerRole
    );

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
    console.log(
      "Checking if the default server role can create channels.",
      serverRoleToCheck.canCreateChannel
    );
    if (permission === "createEvent") {
      return serverRoleToCheck.canCreateEvent;
    }
    if (permission === "createDiscussion") {
      console.log("checking if the default server role can create discussions");
      return serverRoleToCheck.canCreateDiscussion;
    }
    if (permission === "createComment") {
      return serverRoleToCheck.canCreateComment;
    }
    console.log("The action is not allowed by the default server role.");
    return new Error(ERROR_MESSAGES.channel.noChannelPermission);
  }
);
