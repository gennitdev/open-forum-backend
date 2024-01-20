import { rule } from "graphql-shield";
import { isAuthenticatedAndVerified } from "./userDataHelperFunctions.js";
import { hasServerPermission } from "./hasServerPermission.js";
import { isChannelOwner, isAccountOwner } from "./isOwner.js";
import { hasChannelPermission } from "./hasChannelPermission.js";
import { ChannelPermissionChecks } from "./hasChannelPermission.js";
import {
  CommentCreateInput,
  DiscussionCreateInput,
  EventCreateInput,
} from "../src/generated/graphql.js";

type CheckChannelPermissionInput = {
  channelConnections: string[];
  context: any;
  permissionCheck: string;
};

// Helper function to check channel permissions
async function checkChannelPermissions(
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
  discussionCreateInput: DiscussionCreateInput;
  channelConnections: string[];
};

export const canCreateDiscussion = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateDiscussionArgs, ctx: any, info: any) => {
    console.log(" can create discussion rule is running, args are ", args);

    const channelConnections = args.channelConnections;

    console.log("discussion create input is ", args.discussionCreateInput);

    console.log("channel connections are ", channelConnections);

    return checkChannelPermissions({
      channelConnections,
      context: ctx,
      permissionCheck: ChannelPermissionChecks.CREATE_DISCUSSION,
    });
  }
);

type CanCreateEventArgs = {
  eventCreateInput: EventCreateInput;
  channelConnections: string[];
};

export const canCreateEvent = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateEventArgs, ctx: any, info: any) => {
    console.log(" can create event rule is running, args are ", args);

    const channelConnections = args.channelConnections;

    console.log("event create input is ", args.eventCreateInput);

    console.log("channel connections are ", channelConnections);

    return checkChannelPermissions({
      channelConnections,
      context: ctx,
      permissionCheck: ChannelPermissionChecks.CREATE_EVENT,
    });
  }
);

type CanCreateCommentArgs = {
  input: CommentCreateInput[];
};

export const canCreateComment = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateCommentArgs, ctx: any, info: any) => {
    console.log(" can create comment rule is running ", args);

    const { input } = args;
    const firstItemInInput = input[0];

    if (!firstItemInInput) {
      return new Error("No comment create input found.");
    }

    const { DiscussionChannel } = firstItemInInput;

    if (!DiscussionChannel) {
      return new Error("No discussion channel found.");
    }


    console.log("comment create input is ", input);
    console.log("discussion channel is ", DiscussionChannel);

    const discussionChannelId = DiscussionChannel.connect?.where?.node?.id;

    if (!discussionChannelId) {
      return new Error("No discussion channel ID found.");
    }

    // Look up the channelUniqueName from the discussion channel ID.
    const discussionChannelModel = ctx.ogm.model("DiscussionChannel");
    const discussionChannel = await discussionChannelModel.find({
      where: { id: discussionChannelId },
      selectionSet: `{ channelUniqueName }`,
    });

    if (!discussionChannel || !discussionChannel[0]) {
      return new Error("No discussion channel found.");
    }

    console.log("discussion channel is ", discussionChannel);

    const channelName = discussionChannel[0]?.channelUniqueName;

    if (!channelName) {
      return new Error("No channel name found.");
    }

    return checkChannelPermissions({
      channelConnections: [channelName],
      context: ctx,
      permissionCheck: ChannelPermissionChecks.CREATE_COMMENT,
    });
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
  canCreateComment,
  canCreateDiscussion,
  canCreateEvent,
  hasChannelPermission,
  isAdmin,
  isAccountOwner,
};

export default ruleList;
