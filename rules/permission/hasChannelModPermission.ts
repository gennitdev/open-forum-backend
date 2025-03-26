import { setUserDataOnContext } from "./userDataHelperFunctions.js";
import { ERROR_MESSAGES } from "../errorMessages.js";

// Define the moderator permissions as an enum for type safety
export enum ModChannelPermission {
  canHideComment = "canHideComment",
  canHideEvent = "canHideEvent",
  canHideDiscussion = "canHideDiscussion",
  canGiveFeedback = "canGiveFeedback",
  canOpenSupportTickets = "canOpenSupportTickets",
  canCloseSupportTickets = "canCloseSupportTickets",
  canReport = "canReport",
  canSuspendUser = "canSuspendUser"
}

type HasChannelModPermissionInput = {
  permission: ModChannelPermission;
  channelName: string;
  context: any;
};

export const hasChannelModPermission: (
  input: HasChannelModPermissionInput
) => Promise<Error | boolean> = async (input: HasChannelModPermissionInput) => {
  const { permission, channelName, context } = input;

  const Channel = context.ogm.model("Channel");
  const Suspension = context.ogm.model("Suspension");

  // 1. Check for mod roles on the user object
  context.user = await setUserDataOnContext({
    context,
    getPermissionInfo: true,
    checkSpecificChannel: channelName,
  });

  // 2. Check if user has a moderation profile
  const hasModProfile = context.user?.data?.ModerationProfile !== null;
  if (!hasModProfile) {
    return new Error(ERROR_MESSAGES.channel.notMod);
  }

  // 3. Get the channel's mod roles and moderator lists
  const channel = await Channel.find({
    where: {
      uniqueName: channelName,
    },
    selectionSet: `{ 
      DefaultModRole { 
        canHideComment
        canHideEvent
        canHideDiscussion
        canGiveFeedback
        canOpenSupportTickets
        canCloseSupportTickets
        canReport
        canSuspendUser
      }
      ElevatedModRole {
        canHideComment
        canHideEvent
        canHideDiscussion
        canGiveFeedback
        canOpenSupportTickets
        canCloseSupportTickets
        canReport
        canSuspendUser
      }
      SuspendedModRole {
        canHideComment
        canHideEvent
        canHideDiscussion
        canGiveFeedback
        canOpenSupportTickets
        canCloseSupportTickets
        canReport
        canSuspendUser
      }
      SuspendedMods {
        modProfileName
      }
    }`,
  });

  if (!channel || !channel[0]) {
    return new Error(ERROR_MESSAGES.channel.notFound);
  }

  const channelData = channel[0];
  const modProfileName = context.user?.data?.ModerationProfile?.displayName;

  // 4. Determine which role to use based on moderator status
  let roleToUse = null;

  // First check if the user is suspended
  // Fetch Suspensions with channelUniqueName and modProfileName
  const isSuspendedResult = await Suspension.find({
    where: {
      channelUniqueName: channelName,
      modProfileName: modProfileName,
    },
    selectionSet: `{ 
      id
    }`,
  });
  const isSuspended = isSuspendedResult && isSuspendedResult.length > 0;
  if (isSuspended) {
    roleToUse = channelData.SuspendedModRole;
  }
  // Then check if the user is an elevated moderator
  // May create custom cypher query to directly
  // look up if such a mod is listed in the Moderators
  // field on the Channel.
  else if (channelData.Moderators?.some(
    (mod: any) => mod.displayName === modProfileName
  )) {
    roleToUse = channelData.ElevatedModRole;
    // if the channel doesn't have an elevated mod role,
    // use the one from the server config.
  }
  // Finally, use the default mod role
  else {
    roleToUse = channelData.DefaultModRole;
  }

  // 5. Check if the role exists and has the required permission
  if (!roleToUse) {
    return new Error(ERROR_MESSAGES.channel.noModRole);
  }

  if (roleToUse[permission] === true) {
    return true;
  }

  // 6. If the user is neither on the elevated mod list, nor the suspended
  // mod list, check the server's default mod role
  const ServerConfig = context.ogm.model("ServerConfig");
  const serverConfig = await ServerConfig.find({
    where: { serverName: process.env.SERVER_CONFIG_NAME },
    selectionSet: `{ 
      DefaultModRole { 
        canOpenSupportTickets
        canLockChannel
        canCloseSupportTickets
        canGiveFeedback
        canHideComment
        canHideDiscussion
        canGiveFeedback
        canReport
        canSuspendUser
      } 
    }`,
  });

  if (serverConfig && serverConfig[0]?.DefaultModRole) {
    const defaultModRole = serverConfig[0].DefaultModRole;
    if (defaultModRole[permission] === true) {
      return true;
    }
  }

  return false;
};

// Helper function to check mod permissions across multiple channels
export async function checkChannelModPermissions(
  input: {
    channelConnections: string[];
    context: any;
    permissionCheck: ModChannelPermission;
  }
) {
  const { channelConnections, context, permissionCheck } = input;

  for (const channelConnection of channelConnections) {
    const permissionResult = await hasChannelModPermission({
      permission: permissionCheck,
      channelName: channelConnection,
      context: context,
    });

    if (!permissionResult) {
      return new Error("The user does not have moderator permission in this channel.");
    }

    if (permissionResult instanceof Error) {
      return permissionResult;
    }
  }

  return true;
}
