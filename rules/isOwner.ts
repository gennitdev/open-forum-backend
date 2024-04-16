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
  UserWhere,
} from "../src/generated/graphql.js";
import { setUserDataOnContext } from "./userDataHelperFunctions.js";

type IsChannelOwnerInput = {
  where: ChannelWhere;
};

export const isChannelOwner = rule({ cache: "contextual" })(
  async (parent: any, args: IsChannelOwnerInput, ctx: any, info: any) => {

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });
    let username = ctx.user.username;

    let ogm = ctx.ogm;
    const { where } = args;
    const { uniqueName } = where;

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
      return new Error(ERROR_MESSAGES.channel.notFound);
    }

    if (channel.length === 0) {
      return new Error(ERROR_MESSAGES.channel.notFound);
    }

    // Get the list of channel owners.
    const channelOwners = channel[0].Admins.map((admin) => admin.username);

    // Check if the user is in the list of channel owners.
    if (!channelOwners.includes(username)) {
      return new Error(ERROR_MESSAGES.channel.notOwner);
    }

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

    const { discussionWhere } = args;
    const { id: discussionId } = discussionWhere;

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });

    let username = ctx.user.username;
    let ogm = ctx.ogm;

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
      return new Error(ERROR_MESSAGES.channel.notFound);
    }
    const discussion = discussions[0];

    // Get the discussion author.
    const discussionOwner = discussion?.Author?.username;

    if (!discussionOwner) {
      return new Error(ERROR_MESSAGES.discussion.noAuthor);
    }

    // Check if the user is in the list of channel owners.
    if (!discussionOwner === username) {
      return new Error(ERROR_MESSAGES.discussion.notOwner);
    }
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

    const { eventWhere } = args;
    const { id: eventId } = eventWhere;

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });

    let username = ctx.user.username;
    let ogm = ctx.ogm;

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
      return new Error(ERROR_MESSAGES.event.notFound);
    }
    const event = events[0];

    // Get the event author.
    const eventOwner = event?.Poster?.username;

    if (!eventOwner) {
      return new Error(ERROR_MESSAGES.event.noOwner);
    }

    // Check if the user is in the list of channel owners.
    if (!eventOwner === username) {
      return new Error(ERROR_MESSAGES.event.notOwner);
    }
    return true;
  }
);

type IsCommentAuthorInput = {
  where: CommentWhere;
  update: CommentWhere;
};

export const isCommentAuthor = rule({ cache: "contextual" })(
  async (parent: any, args: IsCommentAuthorInput, ctx: any, info: any) => {
    const { where } = args;
    const { id: commentId } = where;

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });

    let username = ctx.user.username;
    let modName =  ctx.user.data?.ModerationProfile?.displayName || null;
    let ogm = ctx.ogm;

    if (!commentId) {
      return new Error(ERROR_MESSAGES.comment.noId);
    }
    const CommentModel = ogm.model("Comment");

    // Get the comment owner by using the OGM on the
    // Comment model.
    const comments: Comment[] = await CommentModel.find({
      where: { id: commentId },
      selectionSet: `{ 
        CommentAuthor {
          ... on User {
            username
          }
          ... on ModerationProfile {
            displayName
          }
        }
      }`,
    });

    if (!comments || comments.length === 0) {
      return new Error(ERROR_MESSAGES.comment.notFound);
    }
    const comment = comments[0];

    // Get the comment author.
    const author = comment?.CommentAuthor;
    let authorUsername;
    let authorModProfileName;

    // The comment owner could be a user or a moderation profile.
    // For a user, the username is stored on the user object.
    // For a moderation profile, the displayName is stored on 
    // the moderation profile object.
    if (!author) {
      return new Error(ERROR_MESSAGES.comment.noOwner);
    }

    // @ts-ignore
    if (author.username) {
      // @ts-ignore
      authorUsername = author.username;
    } else if (author.displayName) {
      authorModProfileName = author.displayName;
    } else {
      return new Error(ERROR_MESSAGES.comment.noOwner);
    }

    // Check if the user is the comment author.
    if (authorUsername && !authorUsername === username) {
      return new Error(ERROR_MESSAGES.comment.notOwner);
    }
    if (authorModProfileName && !authorModProfileName === modName) {
      return new Error(ERROR_MESSAGES.comment.notOwner);
    }
    return true;
  }
);

type IsAccountOwnerArgs = {
  where: UserWhere;
}
// Check if the user is the owner of the account.
export const isAccountOwner = rule({ cache: "contextual" })(
  async (parent: any, args: IsAccountOwnerArgs, ctx: any, info: any) => {
    const { username } = args.where;

    // set user data
    ctx.user = await setUserDataOnContext({
      context: ctx,
      getPermissionInfo: false,
    });

    if (!username) {
      return new Error(ERROR_MESSAGES.user.noUsername);
    }

    // Check if the user is the account owner.
    if (!username === ctx.user.username) {
      return new Error(ERROR_MESSAGES.user.notOwner);
    }

    return true;
  }
);
