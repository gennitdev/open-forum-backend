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
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { generate } = pkg;

dotenv.config();

import neo4j, { Driver } from "neo4j-driver";

async function connectToNeo4jWithRetry(driver: Driver, maxRetries = 10, retryDelay = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to connect to Neo4j (Attempt ${attempt}/${maxRetries})...`);
      const session = driver.session();
      await session.run("RETURN 1");
      console.log("Connected to Neo4j!");
      session.close();
      return; // Exit loop on successful connection
    } catch (error) {
      console.error(`Neo4j connection attempt ${attempt} failed: ${(error as any).message}`);
      if (attempt === maxRetries) {
        console.error("Max retries reached. Could not connect to Neo4j.");
        throw error;
      }
      console.log(`Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

if (process.env.GOOGLE_CREDENTIALS_BASE64) {
  const credentials = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
  const credentialsPath = path.join(__dirname, 'listical-dev-gcp.json');
  fs.writeFileSync(credentialsPath, credentials);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
}

const sendSlackNotification = async (text: string) => {
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.error("SLACK_WEBHOOK_URL environment variable is not set");
    return;
  }
  try {
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      text: text,
    });
    console.log("Slack notification sent successfully");
  } catch (error) {
    console.error("Error sending Slack notification:", error);
  }
};

const extractMutationName = (query: string) => {
  const match = query.match(/mutation\s+(\w+)/);
  return match ? match[1] : 'Unknown Mutation';
};

const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
const password = process.env.NEO4J_PASSWORD;
const port = process.env.PORT || 4000;
const user = process.env.NEO4J_USER || "neo4j";

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password as string));

const { ogm, resolvers } = getCustomResolvers(driver);

const features = {
  filters: {
    String: {
      MATCHES: true,
    },
  },
};

const neoSchema = new Neo4jGraphQL({
  typeDefs: typesDefinitions,
  driver,
  resolvers,
  features,
});

const ensureUniqueDiscussionChannelRelationship = `
CREATE CONSTRAINT discussion_channel_unique IF NOT EXISTS FOR (dc:DiscussionChannel)
REQUIRE (dc.discussionId, dc.channelUniqueName) IS NODE KEY
`;

const ensureUniqueEventChannelRelationship = `
CREATE CONSTRAINT event_channel_unique IF NOT EXISTS FOR (ec:EventChannel)
REQUIRE (ec.eventId, ec.channelUniqueName) IS NODE KEY
`;

async function initializeServer() {
  try {
    console.log("Initializing server...");

    await connectToNeo4jWithRetry(driver);

    const session = driver.session();
    const result = await session.run("CALL dbms.components()");
    const edition = result.records[0].get("edition");
    console.log(`Connected to Neo4j Edition: ${edition}`);
    session.close();

    if (edition === "enterprise") {
      await driver.session().run(ensureUniqueDiscussionChannelRelationship);
      await driver.session().run(ensureUniqueEventChannelRelationship);
    }

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
    await neoSchema.assertIndexesAndConstraints();

    const server = new ApolloServer({
      persistedQueries: false,
      schema,
      context: async (input: any) => {
        const { req } = input;
        const queryString = `Query: ${req.body.query}`;
        if (!queryString.includes("IntrospectionQuery")) {
          console.log(queryString);
          console.log(
            `Variables: ${JSON.stringify(req.body.variables, null, 2)}`
          );

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
      formatError: (error: any) => ({
        message: error.message,
        locations: error.locations,
        path: error.path,
        code: error.extensions?.code,
      }),
    });

    server.listen({ port }).then(({ url }) => {
      console.log(`🚀  Server ready at ${url}`);
    });
  } catch (e) {
    console.error("Failed to initialize server:", e);
  }
}

initializeServer();
