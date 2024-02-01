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
import getSubredditResolver from "./customResolvers/queries/getSubreddit.js";
import getSubredditSidebar from "./customResolvers/queries/getSubredditSidebar.js";
import createSignedStorageURL from "./customResolvers/mutations/createSignedStorageURL.js";
import reportDiscussion from "./customResolvers/mutations/reportDiscussion.js";
import reportEvent from "./customResolvers/mutations/reportEvent.js";
import reportComment from "./customResolvers/mutations/reportComment.js";
import giveFeedbackOnDiscussion from "./customResolvers/mutations/giveFeedbackOnDiscussion.js";
import giveFeedbackOnEvent from "./customResolvers/mutations/giveFeedbackOnEvent.js";
import giveFeedbackOnComment from "./customResolvers/mutations/giveFeedbackOnComment.js";
const { OGM } = pkg;
export default function (driver) {
    const ogm = new OGM({
        typeDefs,
        driver,
    });
    const Discussion = ogm.model("Discussion");
    const DiscussionChannel = ogm.model("DiscussionChannel");
    const Event = ogm.model("Event");
    const Comment = ogm.model("Comment");
    const User = ogm.model("User");
    const Issue = ogm.model("Issue");
    const resolvers = {
        JSON: GraphQLJSON,
        CommentAuthor: {
            __resolveType(obj, context, info) {
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
            createDiscussionWithChannelConnections: createDiscussionWithChannelConnections({
                Discussion,
                driver,
            }),
            updateDiscussionWithChannelConnections: updateDiscussionWithChannelConnections({
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
            reportDiscussion: reportDiscussion({ Issue }),
            reportEvent: reportEvent({ Issue }),
            reportComment: reportComment({ Issue }),
            giveFeedbackOnDiscussion: giveFeedbackOnDiscussion({
                Comment
            }),
            giveFeedbackOnEvent: giveFeedbackOnEvent({
                Comment
            }),
            giveFeedbackOnComment: giveFeedbackOnComment({
                Comment
            }),
        },
    };
    return {
        resolvers,
        ogm,
    };
}
