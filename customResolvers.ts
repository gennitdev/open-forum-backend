import { OGM } from "@neo4j/graphql-ogm";
import typeDefs from "./typeDefs";
import GraphQLJSON from "graphql-type-json";
import createDiscussionWithChannelConnections from "./customResolvers/mutations/createDiscussionWithChannelConnections";
import updateDiscussionWithChannelConnections from "./customResolvers/mutations/updateDiscussionWithChannelConnections";

import createEventWithChannelConnections from "./customResolvers/mutations/createEventWithChannelConnections";
import updateEventWithChannelConnections from "./customResolvers/mutations/updateEventWithChannelConnections";

import getSiteWideDiscussionList from "./customResolvers/queries/getSiteWideDiscussionList";
import getCommentSection from "./customResolvers/queries/getCommentSection";
import getEventComments from "./customResolvers/queries/getEventComments";
import getCommentReplies from "./customResolvers/queries/getCommentReplies";
import getDiscussionsInChannel from "./customResolvers/queries/getDiscussionsInChannel";

import addEmojiToComment from "./customResolvers/mutations/addEmojiToComment";
import removeEmojiFromComment from "./customResolvers/mutations/removeEmojiFromComment";
import addEmojiToDiscussionChannel from "./customResolvers/mutations/addEmojiToDiscussionChannel";
import removeEmojiFromDiscussionChannel from "./customResolvers/mutations/removeEmojiFromDiscussionChannel";

import upvoteComment from "./customResolvers/mutations/upvoteComment";
import undoUpvoteComment from "./customResolvers/mutations/undoUpvoteComment";
import upvoteDiscussionChannel from "./customResolvers/mutations/upvoteDiscussionChannel";
import undoUpvoteDiscussionChannel from "./customResolvers/mutations/undoUpvoteDiscussionChannel";

import getSubredditResolver from "./customResolvers/queries/getSubreddit";
import getSubredditSidebar from "./customResolvers/queries/getSubredditSidebar";
import createSignedStorageURL from "./customResolvers/mutations/createSignedStorageURL";

// const { ModelMap } = "./ogm-types"; // this file will be auto-generated using 'generate'

export default function (driver: any) {
  // const ogm = new OGM<ModelMap>({
  //   typeDefs,
  //   driver,
  // });
  const ogm = new OGM({
    typeDefs,
    driver,
  });

  const Discussion = ogm.model("Discussion");
  const DiscussionChannel = ogm.model("DiscussionChannel");
  const Event = ogm.model("Event");
  const Comment = ogm.model("Comment");
  const User = ogm.model("User");

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
      getSubreddit: getSubredditResolver(),
      getSubredditSidebar: getSubredditSidebar(),
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
    },
  };
  return {
    resolvers,
    ogm,
  };
};
