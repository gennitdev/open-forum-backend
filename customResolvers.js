const { OGM } = require("@neo4j/graphql-ogm");
const typeDefs = require("./typeDefs");
const createDiscussionWithChannelConnections = require("./customResolvers/createDiscussionWithChannelConnections");

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
    },
  };
  return {
    resolvers,
    ogm,
  };
};
