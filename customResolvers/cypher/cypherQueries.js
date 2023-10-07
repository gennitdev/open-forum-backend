// main.js
const fs = require('fs');
const path = require('path');
const createDiscussionChannelQuery = fs.readFileSync(path.resolve(__dirname, './createDiscussionChannelQuery.cypher'), 'utf8');
const createEventChannelQuery = fs.readFileSync(path.resolve(__dirname, './createEventChannelQuery.cypher'), 'utf8');
const updateDiscussionChannelQuery = fs.readFileSync(path.resolve(__dirname, './updateDiscussionChannelQuery.cypher'), 'utf8');
const updateEventChannelQuery = fs.readFileSync(path.resolve(__dirname, './updateEventChannelQuery.cypher'), 'utf8');
const severConnectionBetweenDiscussionAndChannelQuery = fs.readFileSync(path.resolve(__dirname, './severConnectionBetweenDiscussionAndChannelQuery.cypher'), 'utf8');
const commentIsUpvotedByUserQuery = fs.readFileSync(path.resolve(__dirname, './commentIsUpvotedByUserQuery.cypher'), 'utf8');
const discussionChannelIsUpvotedByUserQuery = fs.readFileSync(path.resolve(__dirname, './discussionChannelIsUpvotedByUserQuery.cypher'), 'utf8');
const getCommentsQuery = fs.readFileSync(path.resolve(__dirname, './getCommentsQuery.cypher'), 'utf8');
const getDiscussionChannelsQuery = fs.readFileSync(path.resolve(__dirname, './getDiscussionChannelsQuery.cypher'), 'utf8');
const getSiteWideDiscussionsQuery = fs.readFileSync(path.resolve(__dirname, './getSiteWideDiscussionsQuery.cypher'), 'utf8');

module.exports = {
  createDiscussionChannelQuery,
  updateDiscussionChannelQuery,
  createEventChannelQuery,
  updateEventChannelQuery,
  severConnectionBetweenDiscussionAndChannelQuery,
  commentIsUpvotedByUserQuery,
  discussionChannelIsUpvotedByUserQuery,
  getCommentsQuery,
  getDiscussionChannelsQuery,
  getSiteWideDiscussionsQuery,
};
