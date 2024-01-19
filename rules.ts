import { rule } from "graphql-shield";
import { isAuthenticatedAndVerified } from "./rules/userDataHelperFunctions.js";
import { hasServerPermission } from "./rules/hasServerPermission.js";
import { isChannelOwner, isAccountOwner } from "./rules/isOwner.js";
import { hasChannelPermission } from "./rules/hasChannelPermission.js";

const canCreateChannel = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    console.log(" can create channel rule is running ");

    const hasPermissionToCreateChannels = hasServerPermission(
      "createChannel",
      ctx
    );

    if (hasPermissionToCreateChannels instanceof Error) {
      console.log("The user does not have permission to create channels.");
      return hasPermissionToCreateChannels;
    }

    console.log("passed rule: can create channel");
    return true;
  }
);

type CanCreateDiscussionArgs = {
  discussionCreateInput: any;
  channelConnections: string[];
};

export const canCreateDiscussion = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateDiscussionArgs, ctx: any, info: any) => {
    console.log(" can create discussion rule is running, args are ", args);
    const channelModel = ctx.ogm.model("Channel");


    const channelConnections = args.channelConnections;

    console.log('discussion create input is ', args.discussionCreateInput)

    console.log("channel connections are ", channelConnections);

    for (const channelConnection of channelConnections) {
      const hasPermissionToCreateDiscussions = await hasChannelPermission({
        permission: "createDiscussion",
        channelName: channelConnection,
        context: ctx,
        Channel: channelModel,
      });

      if (hasPermissionToCreateDiscussions instanceof Error) {
        console.log('has channel permission returned error', hasPermissionToCreateDiscussions.message)
        console.log(
          "The user does not have permission to create discussions in this channel: ",
          channelConnection
        );
        return hasPermissionToCreateDiscussions;
      }
    }

    console.log("passed rule: can create discussion");
    return true;
  }
);

const isAdmin = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    const { isAdmin } = ctx.user;
    console.log("passed rule: is admin");
    return isAdmin;
  }
);

const ruleList = {
  isChannelOwner,
  isAuthenticatedAndVerified,
  canCreateChannel,
  canCreateDiscussion,
  hasChannelPermission,
  isAdmin,
  isAccountOwner,
};

export default ruleList;
