import { rule } from "graphql-shield";
import { ERROR_MESSAGES } from "../rules/errorMessages.js";
import {
  ChannelWhere,
  Channel,
  Comment,
  Discussion,
  Event,
  DiscussionWhere,
  DiscussionUpdateInput,
  EventWhere,
  EventUpdateInput,
  CommentWhere,
} from "../src/generated/graphql.js";
import { setUserDataOnContext } from "./userDataHelperFunctions.js";

type IsChannelOwnerInput = {
  where: ChannelWhere;
};

export const isChannelOwner = rule({ cache: "contextual" })(
  async (parent: any, args: IsChannelOwnerInput, ctx: any, info: any) => {
    console.log("is channel owner rule is running", args);

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });
    console.log("set user data on context. user data is ", ctx.user);
    let username = ctx.user.username;

    console.log("username is ", username);
    let ogm = ctx.ogm;
    const { where } = args;
    const { uniqueName } = where;
    console.log("unique name is ", uniqueName);

    if (!uniqueName) {
      return new Error(ERROR_MESSAGES.channel.notFound);
    }
    const ChannelModel = ogm.model("Channel");

    // Get the list of channel owners by using the OGM on the
    // Channel object.
    const channel: Channel[] = await ChannelModel.find({
      where: { uniqueName },
      selectionSet: `{ 
            Admins { 
                username
            } 
      }`,
    });

    if (!channel) {
      console.log("channel not found");
      return new Error(ERROR_MESSAGES.channel.notFound);
    }

    if (channel.length === 0) {
      console.log("channel not found 2");
      return new Error(ERROR_MESSAGES.channel.notFound);
    }

    // Get the list of channel owners.
    const channelOwners = channel[0].Admins.map((admin) => admin.username);
    console.log("channel owners are ", channelOwners);
    console.log("logged in user is ", username);

    // Check if the user is in the list of channel owners.
    if (!channelOwners.includes(username)) {
      return new Error(ERROR_MESSAGES.channel.notOwner);
    }

    console.log("passed rule: is channel owner");
    return true;
  }
);

type IsDiscussionOwnerInput = {
  discussionWhere: DiscussionWhere;
  discussionUpdateInput: DiscussionUpdateInput;
  channelConnections: string[];
  channelDisconnections: string[];
};

export const isDiscussionOwner = rule({ cache: "contextual" })(
  async (parent: any, args: IsDiscussionOwnerInput, ctx: any, info: any) => {
    console.log("is discussion owner rule is running", args);

    const { discussionWhere } = args;
    const { id: discussionId } = discussionWhere;

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });

    console.log("set user data on context. user data is ", ctx.user);

    let username = ctx.user.username;

    console.log("username is ", username);
    let ogm = ctx.ogm;

    console.log("discussion id is ", discussionId);

    if (!discussionId) {
      return new Error(ERROR_MESSAGES.discussion.noId);
    }
    const DiscussionModel = ogm.model("Discussion");

    // Get the discussion owner by using the OGM on the
    // Discussion model.
    const discussions: Discussion[] = await DiscussionModel.find({
      where: { id: discussionId },
      selectionSet: `{ 
            Author { 
                username
            } 
      }`,
    });

    if (!discussions || discussions.length === 0) {
      console.log("discussion not found");
      return new Error(ERROR_MESSAGES.channel.notFound);
    }
    const discussion = discussions[0];
    console.log("fetched discussion data is ", discussion);

    // Get the discussion author.
    const discussionOwner = discussion?.Author?.username;

    if (!discussionOwner) {
      console.log("discussion author not found");
      return new Error(ERROR_MESSAGES.discussion.noAuthor);
    }
    console.log("discussion owner is ", discussionOwner);
    console.log("logged in user is ", username);

    // Check if the user is in the list of channel owners.
    if (!discussionOwner === username) {
      return new Error(ERROR_MESSAGES.discussion.notOwner);
    }

    console.log("passed rule: is discussion owner");
    return true;
  }
);

type IsEventOwnerInput = {
  eventWhere: EventWhere;
  eventUpdateInput: EventUpdateInput;
  channelConnections: string[];
  channelDisconnections: string[];
};

export const isEventOwner = rule({ cache: "contextual" })(
  async (parent: any, args: IsEventOwnerInput, ctx: any, info: any) => {
    console.log("is event owner rule is running", args);

    const { eventWhere } = args;
    const { id: eventId } = eventWhere;

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });

    console.log("set user data on context. user data is ", ctx.user);

    let username = ctx.user.username;

    console.log("username is ", username);
    let ogm = ctx.ogm;

    console.log("event id is ", eventId);

    if (!eventId) {
      return new Error(ERROR_MESSAGES.event.noId);
    }
    const EventModel = ogm.model("Event");

    // Get the event owner by using the OGM on the
    // Event model.
    const events: Event[] = await EventModel.find({
      where: { id: eventId },
      selectionSet: `{ 
            Poster { 
                username
            } 
      }`,
    });

    if (!events || events.length === 0) {
      console.log("event not found");
      return new Error(ERROR_MESSAGES.event.notFound);
    }
    const event = events[0];
    console.log("fetched event data is ", event);

    // Get the event author.
    const eventOwner = event?.Poster?.username;

    if (!eventOwner) {
      console.log("event owner not found");
      return new Error(ERROR_MESSAGES.event.noOwner);
    }
    console.log("event owner is ", eventOwner);
    console.log("logged in user is ", username);

    // Check if the user is in the list of channel owners.
    if (!eventOwner === username) {
      return new Error(ERROR_MESSAGES.event.notOwner);
    }

    console.log("passed rule: is event owner");
    return true;
  }
);

type IsCommentAuthorInput = {
  where: CommentWhere;
  update: CommentWhere;
};

export const isCommentAuthor = rule({ cache: "contextual" })(
  async (parent: any, args: IsCommentAuthorInput, ctx: any, info: any) => {
    console.log("is comment owner rule is running", args);

    const { where } = args;
    const { id: commentId } = where;

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });

    console.log("set user data on context. user data is ", ctx.user);

    let username = ctx.user.username;

    console.log("username is ", username);
    let ogm = ctx.ogm;

    console.log("comment id is ", commentId);

    if (!commentId) {
      return new Error(ERROR_MESSAGES.comment.noId);
    }
    const CommentModel = ogm.model("Comment");

    // Get the comment owner by using the OGM on the
    // Comment model.

    console.log("getting comment data");
    const comments: Comment[] = await CommentModel.find({
      where: { id: commentId },
      selectionSet: `{ 
        CommentAuthor {
          ... on User {
            username
          }
        }
      }`,
    });

    if (!comments || comments.length === 0) {
      console.log("comment not found");
      return new Error(ERROR_MESSAGES.comment.notFound);
    }
    const comment = comments[0];
    console.log("fetched comment data is ", comment);

    // Get the comment author.
    const commentOwner = comment?.CommentAuthor?.username;

    if (!commentOwner) {
      console.log("comment owner not found");
      return new Error(ERROR_MESSAGES.comment.noOwner);
    }
    console.log("comment owner is ", commentOwner);
    console.log("logged in user is ", username);

    // Check if the user is the comment author.
    if (!commentOwner === username) {
      return new Error(ERROR_MESSAGES.comment.notOwner);
    }

    console.log("passed rule: is comment owner");
    return true;
  }
);

// Check if the user is the owner of the account.
export const isAccountOwner = rule({ cache: "contextual" })(
  async (parent: any, args: any, ctx: any, info: any) => {
    const { username } = ctx.user;
    const { usernameToCompare } = args;

    if (username !== usernameToCompare) {
      return new Error(ERROR_MESSAGES.generic.noPermission);
    }

    console.log("passed rule: is account owner");
    return true;
  }
);
