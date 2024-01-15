// main.js
var fs = require('fs');
var path = require('path');
export var createDiscussionChannelQuery = fs.readFileSync(path.resolve(__dirname, './createDiscussionChannelQuery.cypher'), 'utf8');
export var createEventChannelQuery = fs.readFileSync(path.resolve(__dirname, './createEventChannelQuery.cypher'), 'utf8');
export var updateDiscussionChannelQuery = fs.readFileSync(path.resolve(__dirname, './updateDiscussionChannelQuery.cypher'), 'utf8');
export var updateEventChannelQuery = fs.readFileSync(path.resolve(__dirname, './updateEventChannelQuery.cypher'), 'utf8');
export var severConnectionBetweenDiscussionAndChannelQuery = fs.readFileSync(path.resolve(__dirname, './severConnectionBetweenDiscussionAndChannelQuery.cypher'), 'utf8');
export var commentIsUpvotedByUserQuery = fs.readFileSync(path.resolve(__dirname, './commentIsUpvotedByUserQuery.cypher'), 'utf8');
export var discussionChannelIsUpvotedByUserQuery = fs.readFileSync(path.resolve(__dirname, './discussionChannelIsUpvotedByUserQuery.cypher'), 'utf8');
export var getCommentsQuery = fs.readFileSync(path.resolve(__dirname, './getCommentsQuery.cypher'), 'utf8');
export var getDiscussionChannelsQuery = fs.readFileSync(path.resolve(__dirname, './getDiscussionChannelsQuery.cypher'), 'utf8');
export var getSiteWideDiscussionsQuery = fs.readFileSync(path.resolve(__dirname, './getSiteWideDiscussionsQuery.cypher'), 'utf8');
export var getCommentRepliesQuery = fs.readFileSync(path.resolve(__dirname, './getCommentRepliesQuery.cypher'), 'utf8');
export var getEventCommentsQuery = fs.readFileSync(path.resolve(__dirname, './getEventCommentsQuery.cypher'), 'utf8');
