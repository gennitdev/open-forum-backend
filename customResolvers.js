const { OGM } = require("@neo4j/graphql-ogm");
const typeDefs = require("./typeDefs");
const createDiscussionWithChannelConnections = require("./customResolvers/createDiscussionWithChannelConnections");
const updateDiscussionWithChannelConnections = require("./customResolvers/updateDiscussionWithChannelConnections");

module.exports = function (driver) {
  const ogm = new OGM({
    typeDefs,
    driver,
  });

  const Discussion = ogm.model("Discussion");

  const resolvers = {
    Mutation: {
      createDiscussionWithChannelConnections: createDiscussionWithChannelConnections({
        Discussion,
        driver
      }),
      updateDiscussionWithChannelConnections: updateDiscussionWithChannelConnections({
        Discussion,
        driver
      })
    },
  };
  return {
    resolvers,
    ogm,
  };
};
