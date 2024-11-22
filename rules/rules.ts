import { rule } from "graphql-shield";
import { isAuthenticatedAndVerified } from "./permission/userDataHelperFunctions.js";
import { hasServerPermission } from "./permission/hasServerPermission.js";
import { hasServerModPermission } from "./permission/hasServerModPermission.js";
import {
  isChannelOwner,
  isAccountOwner,
  isDiscussionOwner,
  isEventOwner,
  isCommentAuthor,
} from "./permission/isOwner.js";
import {
  ChannelPermissionChecks,
  ServerPermissionChecks,
  ServerModPermissionChecks,
  hasChannelPermission,
} from "./permission/hasChannelPermission.js";
import { checkChannelPermissions } from "./permission/hasChannelPermission.js";
import {
  CommentCreateInput,
  DiscussionCreateInput,
  EventCreateInput,
  EventUpdateInput
} from "../src/generated/graphql.js";
import { createDiscussionInputIsValid, updateDiscussionInputIsValid } from "./validation/discussionIsValid.js";
import { createCommentInputIsValid, updateCommentInputIsValid } from "./validation/commentIsValid.js";
import { createEventInputIsValid, updateEventInputIsValid } from "./validation/eventIsValid.js";
import { createChannelInputIsValid, updateChannelInputIsValid } from "./validation/channelIsValid.js";
import { setUserDataOnContext } from "./permission/userDataHelperFunctions.js";

const canCreateChannel = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    const hasPermissionToCreateChannels = hasServerPermission(
      "canCreateChannel",
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
  eventUpdateInput: EventUpdateInput;
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
      throw new Error("No comment create input found.");
    }

    const { DiscussionChannel } = firstItemInInput;

    if (!DiscussionChannel) {
      throw new Error("No discussion channel found.");
    }

    const discussionChannelId = DiscussionChannel.connect?.where?.node?.id_EQ

    if (!discussionChannelId) {
      throw new Error("No discussion channel ID found.");
    }

    // Look up the channelUniqueName from the discussion channel ID.
    const discussionChannelModel = ctx.ogm.model("DiscussionChannel");
    const discussionChannel = await discussionChannelModel.find({
      where: { id: discussionChannelId },
      selectionSet: `{ channelUniqueName }`,
    });

    if (!discussionChannel || !discussionChannel[0]) {
      throw new Error("No discussion channel found.");
    }

    const channelName = discussionChannel[0]?.channelUniqueName;

    if (!channelName) {
      throw new Error("No channel name found.");
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

    // set user on context
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: true
    });


    if (!ctx.user) {
      console.log("No user");
      return false;
    }
    let isAdmin = false
    const serverRoles = ctx.user?.data?.ServerRoles || [];
    const email = ctx.user?.email;

    if (email === process.env.CYPRESS_ADMIN_TEST_EMAIL) {
      // This email is used only for cypress tests. We need 
      // to whitelist it as an admin so that we don't have the catch-22
      // of needing an admin to create an admin.
      isAdmin = true;
    }
    for (const role of serverRoles) {
      if (role.showAdminTag) {
        isAdmin = true;
      }
    }
    console.log('user data', ctx.user)
    return isAdmin;
  }
);

const canUploadFile = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    console.log("Checking if user can upload file");
    const permissionResult = await hasServerPermission(
      ServerPermissionChecks.UPLOAD_FILE,
      ctx
    );

    if (!permissionResult) {
      console.log("no permission result");
      return false;
    }

    if (permissionResult instanceof Error) {
      console.log("permission error")
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
      throw new Error("All arguments (commentId, username) are required");
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
      throw new Error("No comment found.");
    }

    const channelThatCommentIsIn =
      commentData[0]?.DiscussionChannel?.channelUniqueName;

    if (!channelThatCommentIsIn) {
      throw new Error("No channel found.");
    }

    const permissionResult = await hasChannelPermission({
      permission: ChannelPermissionChecks.UPVOTE_COMMENT,
      channelName: channelThatCommentIsIn,
      context: ctx,
    });

    if (!permissionResult) {
      throw new Error("The user does not have permission in this channel.");
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
      throw new Error(
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
      throw new Error("No discussion channel found.");
    }

    const channelName = discussionChannelData[0]?.channelUniqueName;

    if (!channelName) {
      throw new Error("No channel found.");
    }

    const permissionResult = await hasChannelPermission({
      permission: ChannelPermissionChecks.UPVOTE_DISCUSSION,
      channelName,
      context: ctx,
    });

    if (!permissionResult) {
      throw new Error("The user does not have permission in this channel.");
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
  createChannelInputIsValid,
  createCommentInputIsValid,
  updateChannelInputIsValid,
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
