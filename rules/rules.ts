import { rule } from "graphql-shield";
import { isAuthenticatedAndVerified } from "./userDataHelperFunctions.js";
import { hasServerPermission } from "./hasServerPermission.js";
import { hasServerModPermission } from "./hasServerModPermission.js";
import {
  isChannelOwner,
  isAccountOwner,
  isDiscussionOwner,
  isEventOwner,
  isCommentAuthor,
} from "./isOwner.js";
import {
  ChannelPermissionChecks,
  ServerPermissionChecks,
  ServerModPermissionChecks,
  hasChannelPermission,
} from "./hasChannelPermission.js";
import { checkChannelPermissions } from "./hasChannelPermission.js";
import {
  CommentCreateInput,
  DiscussionCreateInput,
  EventCreateInput,
} from "../src/generated/graphql.js";
import { createDiscussionInputIsValid, updateDiscussionInputIsValid } from "./discussionIsValid.js";
import { createCommentInputIsValid, updateCommentInputIsValid } from "./commentIsValid.js";
import { createEventInputIsValid, updateEventInputIsValid } from "./eventIsValid.js";
import { createChannelInputIsValid, updateChannelInputIsValid } from "./channelIsValid.js";

const canCreateChannel = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    const hasPermissionToCreateChannels = hasServerPermission(
      "createChannel",
      ctx
    );

    if (hasPermissionToCreateChannels instanceof Error) {
      return hasPermissionToCreateChannels;
    }

    return true;
  }
);

export type CanCreateDiscussionArgs = {
  discussionCreateInput: DiscussionCreateInput;
  channelConnections: string[];
};

export type CanUpdateDiscussionArgs = {
  discussionUpdateInput: DiscussionCreateInput;
  channelConnections: string[];
};

export const canCreateDiscussion = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateDiscussionArgs, ctx: any, info: any) => {
    const channelConnections = args.channelConnections;

    return checkChannelPermissions({
      channelConnections,
      context: ctx,
      permissionCheck: ChannelPermissionChecks.CREATE_DISCUSSION,
    });
  }
);

export type CanUpdateEventArgs = {
  eventCreateInput: EventCreateInput;
  channelConnections: string[];
};

export const canUpdateEvent = rule({ cache: "contextual" })(
  async (parent: any, args: CanUpdateEventArgs, ctx: any, info: any) => {
    const channelConnections = args.channelConnections;

    return checkChannelPermissions({
      channelConnections,
      context: ctx,
      permissionCheck: ChannelPermissionChecks.UPDATE_EVENT,
    });
  }
);

export type CanCreateEventArgs = {
  eventCreateInput: EventCreateInput;
  channelConnections: string[];
};

export const canCreateEvent = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateEventArgs, ctx: any, info: any) => {
    const channelConnections = args.channelConnections;

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
    const { input } = args;
    const firstItemInInput = input[0];

    if (!firstItemInInput) {
      return new Error("No comment create input found.");
    }

    const { DiscussionChannel } = firstItemInInput;

    if (!DiscussionChannel) {
      return new Error("No discussion channel found.");
    }

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
    if (!ctx.user) {
      return false;
    }
    const { isAdmin } = ctx.user;
    return isAdmin;
  }
);

const canUploadFile = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    const permissionResult = await hasServerPermission(
      ServerPermissionChecks.UPLOAD_FILE,
      ctx
    );

    if (!permissionResult) {
      return false;
    }

    if (permissionResult instanceof Error) {
      return permissionResult;
    }

    return true;
  }
);

type CanUpvoteCommentArgs = {
  commentId: string;
  username: string;
};

const canUpvoteComment = rule({ cache: "contextual" })(
  async (parent: any, args: CanUpvoteCommentArgs, ctx: any, info: any) => {
    const CommentModel = ctx.ogm.model("Comment");

    const { commentId, username } = args;

    if (!commentId || !username) {
      return new Error("All arguments (commentId, username) are required");
    }

    const commentData = await CommentModel.find({
      where: { id: commentId },
      selectionSet: `{ 
        id
        DiscussionChannel {
          channelUniqueName
        }
      }`,
    });

    if (!commentData || !commentData[0]) {
      return new Error("No comment found.");
    }

    const channelThatCommentIsIn =
      commentData[0]?.DiscussionChannel?.channelUniqueName;

    if (!channelThatCommentIsIn) {
      return new Error("No channel found.");
    }

    const permissionResult = await hasChannelPermission({
      permission: ChannelPermissionChecks.UPVOTE_COMMENT,
      channelName: channelThatCommentIsIn,
      context: ctx,
    });

    if (!permissionResult) {
      return new Error("The user does not have permission in this channel.");
    }

    if (permissionResult instanceof Error) {
      return permissionResult;
    }

    return true;
  }
);

type CanUpvoteDiscussionChannelArgs = {
  discussionChannelId: string;
  username: string;
};

const canUpvoteDiscussion = rule({ cache: "contextual" })(
  async (
    parent: any,
    args: CanUpvoteDiscussionChannelArgs,
    ctx: any,
    info: any
  ) => {
    const DiscussionChannelModel = ctx.ogm.model("DiscussionChannel");

    // get channel name from discussion channel id
    const { discussionChannelId, username } = args;

    if (!discussionChannelId || !username) {
      return new Error(
        "All arguments (discussionChannelId, username) are required"
      );
    }

    const discussionChannelData = await DiscussionChannelModel.find({
      where: { id: discussionChannelId },
      selectionSet: `{ 
        id
        channelUniqueName
      }`,
    });

    if (!discussionChannelData || !discussionChannelData[0]) {
      return new Error("No discussion channel found.");
    }

    const channelName = discussionChannelData[0]?.channelUniqueName;

    if (!channelName) {
      return new Error("No channel found.");
    }

    const permissionResult = await hasChannelPermission({
      permission: ChannelPermissionChecks.UPVOTE_DISCUSSION,
      channelName,
      context: ctx,
    });

    if (!permissionResult) {
      return new Error("The user does not have permission in this channel.");
    }

    if (permissionResult instanceof Error) {
      return permissionResult;
    }

    return true;
  }
);

const canGiveFeedback = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    const permissionResult = await hasServerModPermission(
      ServerModPermissionChecks.GIVE_FEEDBACK,
      ctx
    );

    if (!permissionResult) {
      return false;
    }

    if (permissionResult instanceof Error) {
      return permissionResult;
    }

    return true;
  }
);

const canReportContent = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    // Placeholder rule for now

    return true;
  }
);

const issueIsValid = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {

    return true;
  }
);

const ruleList = {
  isChannelOwner,
  isDiscussionOwner,
  isEventOwner,
  isCommentAuthor,
  isAuthenticatedAndVerified,
  issueIsValid,
  canCreateChannel,
  canCreateComment,
  canCreateDiscussion,
  canCreateEvent,
  createCommentInputIsValid,
  updateCommentInputIsValid,
  createDiscussionInputIsValid,
  updateDiscussionInputIsValid,
  createEventInputIsValid,
  updateEventInputIsValid,
  hasChannelPermission,
  isAdmin,
  isAccountOwner,
  canUploadFile,
  canUpvoteComment,
  canUpvoteDiscussion,
  canGiveFeedback,
  canReportContent,
};

export default ruleList;
