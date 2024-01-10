"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { Neo4jGraphQL } = require("@neo4j/graphql");
const { ApolloServer } = require("apollo-server");
const { applyMiddleware } = require("graphql-middleware");
const typeDefs = require("./typeDefs");
const permissions = require("./permissions");
require("dotenv").config();
const neo4j = require("neo4j-driver");
const password = process.env.NEO4J_PASSWORD;
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", password));
const { ogm, resolvers } = require("./customResolvers")(driver);
const features = {
    filters: {
        String: {
            MATCHES: true,
        },
    },
};
// We're passing customResolvers to the Neo4jGraphQL constructor
const neoSchema = new Neo4jGraphQL({
    typeDefs,
    driver,
    resolvers,
    features,
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
function initializeServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let schema = yield neoSchema.getSchema();
            schema = applyMiddleware(schema, permissions);
            yield ogm.init();
            yield driver.session().run(constraintQuery);
            yield neoSchema.assertIndexesAndConstraints({ options: { create: true } });
            const server = new ApolloServer({
                schema,
                context: (input) => __awaiter(this, void 0, void 0, function* () {
                    const { req } = input;
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
                }),
            });
            server.listen().then((input) => {
                const { url } = input;
                console.log(`🚀  Server ready at ${url}`);
            });
        }
        catch (e) {
            console.error("Failed to initialize server:", e);
        }
    });
}
initializeServer();
