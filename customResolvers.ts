import pkg from "@neo4j/graphql-ogm";
import typeDefs from "./typeDefs.js";
import GraphQLJSON from "graphql-type-json";
import createDiscussionWithChannelConnections from "./customResolvers/mutations/createDiscussionWithChannelConnections.js";
import updateDiscussionWithChannelConnections from "./customResolvers/mutations/updateDiscussionWithChannelConnections.js";

import createEventWithChannelConnections from "./customResolvers/mutations/createEventWithChannelConnections.js";
import updateEventWithChannelConnections from "./customResolvers/mutations/updateEventWithChannelConnections.js";

import getSiteWideDiscussionList from "./customResolvers/queries/getSiteWideDiscussionList.js";
import getCommentSection from "./customResolvers/queries/getCommentSection.js";
import getEventComments from "./customResolvers/queries/getEventComments.js";
import getCommentReplies from "./customResolvers/queries/getCommentReplies.js";
import getDiscussionsInChannel from "./customResolvers/queries/getDiscussionsInChannel.js";

import addEmojiToComment from "./customResolvers/mutations/addEmojiToComment.js";
import removeEmojiFromComment from "./customResolvers/mutations/removeEmojiFromComment.js";
import addEmojiToDiscussionChannel from "./customResolvers/mutations/addEmojiToDiscussionChannel.js";
import removeEmojiFromDiscussionChannel from "./customResolvers/mutations/removeEmojiFromDiscussionChannel.js";

import upvoteComment from "./customResolvers/mutations/upvoteComment.js";
import undoUpvoteComment from "./customResolvers/mutations/undoUpvoteComment.js";
import upvoteDiscussionChannel from "./customResolvers/mutations/upvoteDiscussionChannel.js";
import undoUpvoteDiscussionChannel from "./customResolvers/mutations/undoUpvoteDiscussionChannel.js";

import createSignedStorageURL from "./customResolvers/mutations/createSignedStorageURL.js";

import safetyCheck from "./customResolvers/queries/safetyCheck.js";

import { ModelMap } from "./ogm-types.js";
import getCreateEmailAndUserResolver from "./customResolvers/mutations/createEmailAndUser.js";

const { OGM } = pkg;

export default function (driver: any) {
  const ogm = new OGM<ModelMap>({
    typeDefs,
    driver,
  });

  const Discussion = ogm.model("Discussion");
  const DiscussionChannel = ogm.model("DiscussionChannel");
  const Event = ogm.model("Event");
  const Comment = ogm.model("Comment");
  const User = ogm.model("User");
  const Email = ogm.model("Email");

  const resolvers = {
    JSON: GraphQLJSON,
    CommentAuthor: {
      __resolveType(obj: any, context: any, info: any) {
        if (obj.username) {
          return "User";
        }
        if (obj.displayName) {
          return "ModerationProfile";
        }
        return "User";
      },
    },
    Query: {
      getSiteWideDiscussionList: getSiteWideDiscussionList({
        Discussion,
        driver,
      }),
      getDiscussionsInChannel: getDiscussionsInChannel({
        driver,
        DiscussionChannel,
      }),
      getCommentSection: getCommentSection({
        driver,
        DiscussionChannel,
        Comment,
      }),
      getEventComments: getEventComments({
        driver,
        Event,
        Comment,
      }),
      getCommentReplies: getCommentReplies({
        driver,
        Comment,
      }),
      safetyCheck: safetyCheck
    },
    Mutation: {
      createDiscussionWithChannelConnections:
        createDiscussionWithChannelConnections({
          Discussion,
          driver,
        }),
      updateDiscussionWithChannelConnections:
        updateDiscussionWithChannelConnections({
          Discussion,
          driver,
        }),
      createEventWithChannelConnections: createEventWithChannelConnections({
        Event,
        driver,
      }),
      updateEventWithChannelConnections: updateEventWithChannelConnections({
        Event,
        driver,
      }),
      addEmojiToComment: addEmojiToComment({
        Comment,
      }),
      removeEmojiFromComment: removeEmojiFromComment({
        Comment,
      }),
      addEmojiToDiscussionChannel: addEmojiToDiscussionChannel({
        DiscussionChannel,
      }),
      removeEmojiFromDiscussionChannel: removeEmojiFromDiscussionChannel({
        DiscussionChannel,
      }),
      upvoteComment: upvoteComment({
        Comment,
        User,
        driver,
      }),
      undoUpvoteComment: undoUpvoteComment({
        Comment,
        User,
        driver,
      }),
      upvoteDiscussionChannel: upvoteDiscussionChannel({
        DiscussionChannel,
        User,
        driver,
      }),
      undoUpvoteDiscussionChannel: undoUpvoteDiscussionChannel({
        DiscussionChannel,
        User,
        driver,
      }),
      createSignedStorageURL: createSignedStorageURL(),
      createEmailAndUser: getCreateEmailAndUserResolver({
        User,
        Email,
      }),
    },
  };
  return {
    resolvers,
    ogm,
  };
}
