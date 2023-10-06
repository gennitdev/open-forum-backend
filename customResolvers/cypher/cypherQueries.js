// main.js
const fs = require('fs');
const path = require('path');
const createDiscussionChannelQuery = fs.readFileSync(path.resolve(__dirname, './createDiscussionChannelQuery.cypher'), 'utf8');
const createEventChannelQuery = fs.readFileSync(path.resolve(__dirname, './createEventChannelQuery.cypher'), 'utf8');
const updateDiscussionChannelQuery = fs.readFileSync(path.resolve(__dirname, './updateDiscussionChannelQuery.cypher'), 'utf8');
const updateEventChannelQuery = fs.readFileSync(path.resolve(__dirname, './updateEventChannelQuery.cypher'), 'utf8');
const severConnectionBetweenDiscussionAndChannelQuery = fs.readFileSync(path.resolve(__dirname, './severConnectionBetweenDiscussionAndChannelQuery.cypher'), 'utf8');
const getSiteWideDiscussionListQuery =  fs.readFileSync(path.resolve(__dirname, './getSiteWideDiscussionListQuery.cypher'), 'utf8');
const commentIsUpvotedByUserQuery = fs.readFileSync(path.resolve(__dirname, './commentIsUpvotedByUserQuery.cypher'), 'utf8');
const discussionChannelIsUpvotedByUserQuery = fs.readFileSync(path.resolve(__dirname, './discussionChannelIsUpvotedByUserQuery.cypher'), 'utf8');
const getTopCommentsQuery = fs.readFileSync(path.resolve(__dirname, './getTopCommentsQuery.cypher'), 'utf8');
const getHotCommentsQuery = fs.readFileSync(path.resolve(__dirname, './getHotCommentsQuery.cypher'), 'utf8');
const getTopDiscussionChannelsQuery = fs.readFileSync(path.resolve(__dirname, './getTopDiscussionChannelsQuery.cypher'), 'utf8');
const getHotDiscussionChannelsQuery = fs.readFileSync(path.resolve(__dirname, './getHotDiscussionChannelsQuery.cypher'), 'utf8');

module.exports = {
  createDiscussionChannelQuery,
  updateDiscussionChannelQuery,
  createEventChannelQuery,
  updateEventChannelQuery,
  severConnectionBetweenDiscussionAndChannelQuery,
  getSiteWideDiscussionListQuery,
  commentIsUpvotedByUserQuery,
  discussionChannelIsUpvotedByUserQuery,
  getTopCommentsQuery,
  getHotCommentsQuery,
  getTopDiscussionChannelsQuery,
  getHotDiscussionChannelsQuery
};
