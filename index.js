const { Neo4jGraphQL } = require("@neo4j/graphql");
const { ApolloServer, gql } = require("apollo-server");
const typeDefs = require("./typeDefs");
const { printSchema } = require("graphql");
const fs = require('fs');

require("dotenv").config();
const neo4j = require("neo4j-driver");
const password = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", password)
);

const { ogm, resolvers } = require("./customResolvers")(driver);

const features = {
  filters: {
      String: {
          MATCHES: true,
      }
  }
};

// We're passing customResolvers to the Neo4jGraphQL constructor
const neoSchema = new Neo4jGraphQL({
  typeDefs,
  driver,
  resolvers,
  features
});

// The DiscussionChannel represents the relationship between a Discussion and a Channel.
// Because the same Discussion should not be submitted to the same Channel twice,
// we need to create a uniqueness constraint on the DiscussionChannel relationship.
const constraintQuery = `
CREATE CONSTRAINT discussion_channel_unique IF NOT EXISTS FOR (dc:DiscussionChannel)
REQUIRE (dc.discussionId, dc.channelUniqueName) IS NODE KEY
`;

// The EventChannel represents the relationship between an Event and a Channel.
// Because the same Event should not be submitted to the same Channel twice,
// we need to create a uniqueness constraint on the EventChannel relationship.
const constraintQuery2 = `
CREATE CONSTRAINT event_channel_unique IF NOT EXISTS FOR (ec:EventChannel)
REQUIRE (ec.eventId, ec.channelUniqueName) IS NODE KEY
`;

async function initializeServer() {
  try {
    const schema = await neoSchema.getSchema();
    await ogm.init();
    await driver.session().run(constraintQuery);
    await neoSchema.assertIndexesAndConstraints({ options: { create: true } });

    const server = new ApolloServer({
      schema,
      context:
        ({ req }) =>
        () => {
          const queryString = `Query: ${req.body.query}`;
          if (!queryString.includes("IntrospectionQuery")) {
            console.log(queryString);
            console.log(`Variables: ${JSON.stringify(req.body.variables, null, 2)}`);
          }
          return {
            driver,
            req,
            ogm,
          };
        },
    });

    server.listen().then(({ url }) => {
      console.log(`🚀  Server ready at ${url}`);
    });
  } catch (e) {
    console.error("Failed to initialize server:", e);
  }
}

initializeServer();
