"use strict";
var OGM = require("@neo4j/graphql-ogm").OGM;
var typeDefs = require("./typeDefs");
var GraphQLJSON = require("graphql-type-json");
var createDiscussionWithChannelConnections = require("./customResolvers/mutations/createDiscussionWithChannelConnections");
var updateDiscussionWithChannelConnections = require("./customResolvers/mutations/updateDiscussionWithChannelConnections");
var createEventWithChannelConnections = require("./customResolvers/mutations/createEventWithChannelConnections");
var updateEventWithChannelConnections = require("./customResolvers/mutations/updateEventWithChannelConnections");
var getSiteWideDiscussionList = require("./customResolvers/queries/getSiteWideDiscussionList");
var getCommentSection = require("./customResolvers/queries/getCommentSection");
var getEventComments = require("./customResolvers/queries/getEventComments");
var getCommentReplies = require("./customResolvers/queries/getCommentReplies");
var getDiscussionsInChannel = require("./customResolvers/queries/getDiscussionsInChannel");
var addEmojiToComment = require("./customResolvers/mutations/addEmojiToComment");
var removeEmojiFromComment = require("./customResolvers/mutations/removeEmojiFromComment");
var addEmojiToDiscussionChannel = require("./customResolvers/mutations/addEmojiToDiscussionChannel");
var removeEmojiFromDiscussionChannel = require("./customResolvers/mutations/removeEmojiFromDiscussionChannel");
var upvoteComment = require("./customResolvers/mutations/upvoteComment");
var undoUpvoteComment = require("./customResolvers/mutations/undoUpvoteComment");
var upvoteDiscussionChannel = require("./customResolvers/mutations/upvoteDiscussionChannel");
var undoUpvoteDiscussionChannel = require("./customResolvers/mutations/undoUpvoteDiscussionChannel");
var getSubredditResolver = require("./customResolvers/queries/getSubreddit");
var getSubredditSidebar = require("./customResolvers/queries/getSubredditSidebar");
var createSignedStorageURL = require("./customResolvers/mutations/createSignedStorageURL");
module.exports = function (driver) {
    var ogm = new OGM({
        typeDefs: typeDefs,
        driver: driver,
    });
    var Discussion = ogm.model("Discussion");
    var DiscussionChannel = ogm.model("DiscussionChannel");
    var Event = ogm.model("Event");
    var Comment = ogm.model("Comment");
    var User = ogm.model("User");
    var resolvers = {
        JSON: GraphQLJSON,
        CommentAuthor: {
            __resolveType: function (obj, context, info) {
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
                Discussion: Discussion,
                driver: driver,
            }),
            getDiscussionsInChannel: getDiscussionsInChannel({
                driver: driver,
                DiscussionChannel: DiscussionChannel,
            }),
            getCommentSection: getCommentSection({
                driver: driver,
                DiscussionChannel: DiscussionChannel,
                Comment: Comment,
            }),
            getEventComments: getEventComments({
                driver: driver,
                Event: Event,
                Comment: Comment,
            }),
            getCommentReplies: getCommentReplies({
                driver: driver,
                Comment: Comment,
            }),
            getSubreddit: getSubredditResolver(),
            getSubredditSidebar: getSubredditSidebar(),
        },
        Mutation: {
            createDiscussionWithChannelConnections: createDiscussionWithChannelConnections({
                Discussion: Discussion,
                driver: driver,
            }),
            updateDiscussionWithChannelConnections: updateDiscussionWithChannelConnections({
                Discussion: Discussion,
                driver: driver,
            }),
            createEventWithChannelConnections: createEventWithChannelConnections({
                Event: Event,
                driver: driver,
            }),
            updateEventWithChannelConnections: updateEventWithChannelConnections({
                Event: Event,
                driver: driver,
            }),
            addEmojiToComment: addEmojiToComment({
                Comment: Comment,
            }),
            removeEmojiFromComment: removeEmojiFromComment({
                Comment: Comment,
            }),
            addEmojiToDiscussionChannel: addEmojiToDiscussionChannel({
                DiscussionChannel: DiscussionChannel,
            }),
            removeEmojiFromDiscussionChannel: removeEmojiFromDiscussionChannel({
                DiscussionChannel: DiscussionChannel,
            }),
            upvoteComment: upvoteComment({
                Comment: Comment,
                User: User,
                driver: driver,
            }),
            undoUpvoteComment: undoUpvoteComment({
                Comment: Comment,
                User: User,
                driver: driver,
            }),
            upvoteDiscussionChannel: upvoteDiscussionChannel({
                DiscussionChannel: DiscussionChannel,
                User: User,
                driver: driver,
            }),
            undoUpvoteDiscussionChannel: undoUpvoteDiscussionChannel({
                DiscussionChannel: DiscussionChannel,
                User: User,
                driver: driver,
            }),
            createSignedStorageURL: createSignedStorageURL(),
        },
    };
    return {
        resolvers: resolvers,
        ogm: ogm,
    };
};
