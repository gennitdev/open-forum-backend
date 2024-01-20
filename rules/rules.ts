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
    const channelModel = ctx.ogm.model("Channel");

    const channelConnections = args.channelConnections;

    console.log("discussion create input is ", args.discussionCreateInput);

    console.log("channel connections are ", channelConnections);

    for (const channelConnection of channelConnections) {
      const hasPermissionToCreateDiscussions = await hasChannelPermission({
        permission: ChannelPermissionChecks.CREATE_DISCUSSION,
        channelName: channelConnection,
        context: ctx,
        Channel: channelModel,
      });

      if (!hasPermissionToCreateDiscussions) {
        console.log(
          "The user does not have permission to create discussions in this channel: ",
          channelConnection
        );
        return new Error(
          "The user does not have permission to create discussions in this channel."
        );
      }

      if (hasPermissionToCreateDiscussions instanceof Error) {
        console.log(
          "has channel permission returned error",
          hasPermissionToCreateDiscussions.message
        );
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

type CanCreateEventArgs = {
  eventCreateInput: EventCreateInput;
  channelConnections: string[];
};

export const canCreateEvent = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateEventArgs, ctx: any, info: any) => {
    console.log(" can create event rule is running, args are ", args);
    const channelModel = ctx.ogm.model("Channel");

    const channelConnections = args.channelConnections;

    console.log("event create input is ", args.eventCreateInput);

    console.log("channel connections are ", channelConnections);

    for (const channelConnection of channelConnections) {
      const hasPermissionToCreateEvents = await hasChannelPermission({
        permission: ChannelPermissionChecks.CREATE_EVENT,
        channelName: channelConnection,
        context: ctx,
        Channel: channelModel,
      });

      if (!hasPermissionToCreateEvents) {
        console.log(
          "The user does not have permission to create evens in this channel: ",
          channelConnection
        );
        return new Error(
          "The user does not have permission to create evens in this channel."
        );
      }

      if (hasPermissionToCreateEvents instanceof Error) {
        console.log(
          "has channel permission returned error",
          hasPermissionToCreateEvents.message
        );
        console.log(
          "The user does not have permission to create evens in this channel: ",
          channelConnection
        );
        return hasPermissionToCreateEvents;
      }
    }

    console.log("passed rule: can create event");
    return true;
  }
);

type CanCreateCommentArgs = {
  commentCreateInput: CommentCreateInput;
};

export const canCreateComment = rule({ cache: "contextual" })(
  async (parent: any, args: CanCreateCommentArgs, ctx: any, info: any) => {
    console.log(" can create comment rule is running ", args);

    const hasPermissionToCreateComments = await hasChannelPermission({
      permission: ChannelPermissionChecks.CREATE_COMMENT,
      channelName: "cats",
      context: ctx,
      Channel: ctx.ogm.model("Channel"),
    });

    if (!hasPermissionToCreateComments) {
      console.log("The user does not have permission to create comments.");
      return new Error("The user does not have permission to create comments.");
    }

    if (hasPermissionToCreateComments instanceof Error) {
      console.log("The user does not have permission to create comments.");
      return hasPermissionToCreateComments;
    }

    console.log("passed rule: can create comment");
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
  canCreateComment,
  canCreateDiscussion,
  canCreateEvent,
  hasChannelPermission,
  isAdmin,
  isAccountOwner,
};

export default ruleList;
