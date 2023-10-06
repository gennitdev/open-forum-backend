const { OGM } = require("@neo4j/graphql-ogm");
const typeDefs = require("./typeDefs");
const createDiscussionWithChannelConnections = require("./customResolvers/createDiscussionWithChannelConnections");
const updateDiscussionWithChannelConnections = require("./customResolvers/updateDiscussionWithChannelConnections");
const updateDiscussionChannelUpvoteCount = require("./customResolvers/updateDiscussionChannelUpvoteCount");

const createEventWithChannelConnections = require("./customResolvers/createEventWithChannelConnections");
const updateEventWithChannelConnections = require("./customResolvers/updateEventWithChannelConnections");

const getSiteWideDiscussionList = require("./customResolvers/getSiteWideDiscussionList");

module.exports = function (driver) {
  const ogm = new OGM({
    typeDefs,
    driver,
  });

  const Discussion = ogm.model("Discussion");
  const DiscussionChannel = ogm.model("DiscussionChannel");
  const Event = ogm.model("Event");

  const resolvers = {
    Query: {
      getSiteWideDiscussionList: getSiteWideDiscussionList({
        Discussion,
        driver,
      }),
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
      updateDiscussionChannelUpvoteCount: updateDiscussionChannelUpvoteCount({
        DiscussionChannel,
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
    },
  };
  return {
    resolvers,
    ogm,
  };
};
