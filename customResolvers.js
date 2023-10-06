const { delegateToSchema } = require("@graphql-tools/delegate");
const { OGM } = require("@neo4j/graphql-ogm");
const typeDefs = require("./typeDefs");

module.exports = function (driver) {
  const ogm = new OGM({
    typeDefs,
    driver,
  });

  const Discussion = ogm.model("Discussion");
  const DiscussionChannel = ogm.model("DiscussionChannel");

  const resolvers = {
    Mutation: {
      createDiscussionTestMutation: async (parent, args, context, info) => {
        const { discussionCreateInput, channelConnections } = args;

        if (!channelConnections || channelConnections.length === 0) {
          throw new Error("At least one channel must be selected");
        }

        try {
          const { discussions } = await Discussion.create({
            input: [discussionCreateInput],
          });
          const newDiscussion = discussions[0];

          const newDiscussionId = newDiscussion.id;

          for (let i = 0; i < channelConnections.length; i++) {
            const channelUniqueName = channelConnections[i];

            // Here we ensure that the channel exists
            const channel = await Channel.find({
              where: { uniqueName: channelUniqueName },
            });
            if (!channel) {
              throw new Error(
                `Channel with uniqueName ${channelUniqueName} does not exist.`
              );
            }

            const { discussionChannels } = await DiscussionChannel.create({
              input: [
                {
                  discussionId: newDiscussionId,
                  channelUniqueName,
                  Discussion: {
                    connect: {
                      where: {
                        node: {
                          id: newDiscussionId,
                        },
                      },
                    },
                  },
                  Channel: {
                    connect: {
                      where: {
                        node: {
                          uniqueName: channelUniqueName,
                        },
                      },
                    },
                  },
                },
              ],
            });
          }
          return newDiscussion;
        } catch (error) {
          console.error("Error creating discussion:", error);
          throw new Error(`Failed to create discussion. ${error.message}`);
        }
      },
    },
  };
  return {
    resolvers,
    ogm,
  };
};
