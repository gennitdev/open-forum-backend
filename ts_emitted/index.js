import { Neo4jGraphQL } from "@neo4j/graphql";
import { ApolloServer } from "apollo-server";
import { applyMiddleware } from "graphql-middleware";
import typesDefinitions from "./typeDefs.js";
import permissions from "./permissions.js";
import path from "path";
import dotenv from "dotenv";
import pkg from '@neo4j/graphql-ogm';
import getCustomResolvers from "./customResolvers.js";
import { fileURLToPath } from 'url';
// Convert the file URL to a directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { generate } = pkg;
dotenv.config();
import neo4j from "neo4j-driver";
const password = process.env.NEO4J_PASSWORD;
console.log({
    uri: process.env.NEO4J_URI,
    password: password ? "********" : undefined,
});
const driver = neo4j.driver(process.env.NEO4J_URI || "bolt://localhost:7687", neo4j.auth.basic("neo4j", password));
const { ogm, resolvers } = getCustomResolvers(driver);
const features = {
    filters: {
        String: {
            MATCHES: true,
        },
    },
};
// We're passing customResolvers to the Neo4jGraphQL constructor
const neoSchema = new Neo4jGraphQL({
    typeDefs: typesDefinitions,
    driver,
    resolvers,
    features,
});
// The DiscussionChannel represents the relationship between a Discussion and a Channel.
// Because the same Discussion should not be submitted to the same Channel twice,
// we need to create a uniqueness constraint on the DiscussionChannel relationship.
const ensureUniqueDiscussionChannelRelationship = `
CREATE CONSTRAINT discussion_channel_unique IF NOT EXISTS FOR (dc:DiscussionChannel)
REQUIRE (dc.discussionId, dc.channelUniqueName) IS NODE KEY
`;
// The EventChannel represents the relationship between an Event and a Channel.
// Because the same Event should not be submitted to the same Channel twice,
// we need to create a uniqueness constraint on the EventChannel relationship.
const ensureUniqueEventChannelRelationship = `
CREATE CONSTRAINT event_channel_unique IF NOT EXISTS FOR (ec:EventChannel)
REQUIRE (ec.eventId, ec.channelUniqueName) IS NODE KEY
`;
async function initializeServer() {
    try {
        if (process.env.GENERATE_OGM_TYPES === "true") {
            const outFile = path.join(__dirname, "ogm-types.ts");
            await generate({
                ogm,
                outFile,
            });
            console.log(`Generated OGM types at ${outFile}`);
            process.exit(1);
        }
        let schema = await neoSchema.getSchema();
        schema = applyMiddleware(schema, permissions);
        await ogm.init();
        await driver.session().run(ensureUniqueDiscussionChannelRelationship);
        await driver.session().run(ensureUniqueEventChannelRelationship);
        await neoSchema.assertIndexesAndConstraints({ options: { create: true } });
        const server = new ApolloServer({
            schema,
            context: async (input) => {
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
            },
        });
        server.listen().then((input) => {
            const { url } = input;
            console.log(`🚀  Server ready at ${url}`);
        });
    }
    catch (e) {
        console.error("Failed to initialize server:", e);
    }
}
initializeServer();
