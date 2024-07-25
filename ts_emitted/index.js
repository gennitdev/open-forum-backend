import { Neo4jGraphQL } from "@neo4j/graphql";
import { ApolloServer } from "apollo-server";
import { applyMiddleware } from "graphql-middleware";
import typesDefinitions from "./typeDefs.js";
import permissions from "./permissions.js";
import path from "path";
import dotenv from "dotenv";
import pkg from "@neo4j/graphql-ogm";
import getCustomResolvers from "./customResolvers.js";
import { fileURLToPath } from "url";
import axios from "axios";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { generate } = pkg;
dotenv.config();
import neo4j from "neo4j-driver";
// if (process.env.GOOGLE_CREDENTIALS_BASE64) {
//   const credentials = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
//   const credentialsPath = path.join(__dirname, 'listical-dev-gcp.json');
//   console.log('Writing Google credentials to', credentialsPath)
//   fs.writeFileSync(credentialsPath, credentials);
//   process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
// }
console.log('GOOGLE_APPLICATION_CREDENTIALS', process.env.GOOGLE_APPLICATION_CREDENTIALS);
const sendSlackNotification = async (text) => {
    if (!process.env.SLACK_WEBHOOK_URL) {
        console.error("SLACK_WEBHOOK_URL environment variable is not set");
        return;
    }
    try {
        await axios.post(process.env.SLACK_WEBHOOK_URL, {
            text: text,
        });
        console.log("Slack notification sent successfully");
    }
    catch (error) {
        console.error("Error sending Slack notification:", error);
    }
};
const extractMutationName = (query) => {
    const match = query.match(/mutation\s+(\w+)/);
    return match ? match[1] : 'Unknown Mutation';
};
const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
const password = process.env.NEO4J_PASSWORD;
const port = process.env.PORT || 4000;
const user = process.env.NEO4J_USER || "neo4j";
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
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
            persistedQueries: false,
            schema,
            context: async (input) => {
                const { req } = input;
                const queryString = `Query: ${req.body.query}`;
                if (!queryString.includes("IntrospectionQuery")) {
                    console.log(queryString);
                    console.log(`Variables: ${JSON.stringify(req.body.variables, null, 2)}`);
                    if (req.body.query.trim().startsWith("mutation")) {
                        const mutationName = extractMutationName(req.body.query);
                        const text = `Mutation: ${mutationName}\nVariables: ${JSON.stringify(req.body.variables, null, 2)}`;
                        // Send Slack notification
                        await sendSlackNotification(text);
                    }
                }
                return {
                    driver,
                    req,
                    ogm,
                };
            },
        });
        server.listen({ port }).then((input) => {
            const { url } = input;
            console.log(`🚀  Server ready at ${url}`);
        });
    }
    catch (e) {
        console.error("Failed to initialize server:", e);
    }
}
initializeServer();
