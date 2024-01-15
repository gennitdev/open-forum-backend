// main.js
const fs = require('fs');
const path = require('path');
export const createDiscussionChannelQuery = fs.readFileSync(path.resolve(__dirname, './createDiscussionChannelQuery.cypher'), 'utf8');
export const createEventChannelQuery = fs.readFileSync(path.resolve(__dirname, './createEventChannelQuery.cypher'), 'utf8');
export const updateDiscussionChannelQuery = fs.readFileSync(path.resolve(__dirname, './updateDiscussionChannelQuery.cypher'), 'utf8');
export const updateEventChannelQuery = fs.readFileSync(path.resolve(__dirname, './updateEventChannelQuery.cypher'), 'utf8');
export const severConnectionBetweenDiscussionAndChannelQuery = fs.readFileSync(path.resolve(__dirname, './severConnectionBetweenDiscussionAndChannelQuery.cypher'), 'utf8');
export const commentIsUpvotedByUserQuery = fs.readFileSync(path.resolve(__dirname, './commentIsUpvotedByUserQuery.cypher'), 'utf8');
export const discussionChannelIsUpvotedByUserQuery = fs.readFileSync(path.resolve(__dirname, './discussionChannelIsUpvotedByUserQuery.cypher'), 'utf8');
export const getCommentsQuery = fs.readFileSync(path.resolve(__dirname, './getCommentsQuery.cypher'), 'utf8');
export const getDiscussionChannelsQuery = fs.readFileSync(path.resolve(__dirname, './getDiscussionChannelsQuery.cypher'), 'utf8');
export const getSiteWideDiscussionsQuery = fs.readFileSync(path.resolve(__dirname, './getSiteWideDiscussionsQuery.cypher'), 'utf8');
export const getCommentRepliesQuery = fs.readFileSync(path.resolve(__dirname, './getCommentRepliesQuery.cypher'), 'utf8');
export const getEventCommentsQuery = fs.readFileSync(path.resolve(__dirname, './getEventCommentsQuery.cypher'), 'utf8');
