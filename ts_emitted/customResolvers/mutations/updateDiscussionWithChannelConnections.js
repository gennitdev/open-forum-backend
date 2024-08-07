import { updateDiscussionChannelQuery, severConnectionBetweenDiscussionAndChannelQuery } from "../cypher/cypherQueries.js";
const getResolver = (input) => {
    const { Discussion, driver } = input;
    return async (parent, args, context, info) => {
        const { where, discussionUpdateInput, channelConnections = [], channelDisconnections = [] } = args;
        try {
            // Update the discussion
            await Discussion.update({
                where: where,
                update: discussionUpdateInput,
            });
            const updatedDiscussionId = where.id;
            const session = driver.session();
            // Update the channel connections
            for (let i = 0; i < channelConnections.length; i++) {
                const channelUniqueName = channelConnections[i];
                // For each channel connection, create a DiscussionChannel node
                // if one does not already exist.
                // Join the DiscussionChannel to the Discussion and Channel nodes.
                // If there was an existing one, join that. If we just created one,
                // join that.
                await session.run(updateDiscussionChannelQuery, {
                    discussionId: updatedDiscussionId,
                    channelUniqueName: channelUniqueName,
                });
            }
            // Update the channel disconnections
            for (let i = 0; i < channelDisconnections.length; i++) {
                const channelUniqueName = channelDisconnections[i];
                // For each channel disconnection, sever the connection between
                // the Discussion and the DiscussionChannel node.
                // We intentionally do not delete the DiscussionChannel node
                // because it contains comments that are authored by other users
                // than the discussion author, and the discussion author should
                // not have permission to delete those comments.
                await session.run(severConnectionBetweenDiscussionAndChannelQuery, {
                    discussionId: updatedDiscussionId,
                    channelUniqueName: channelUniqueName,
                });
            }
            // Refetch the newly created discussion with the channel connections
            // and disconnections so that we can return it.
            const selectionSet = `
        {
          id
          title
          body
          Author {
            username
          }
          DiscussionChannels {
            id
            channelUniqueName
            discussionId
            Channel {
              uniqueName
            }
            Discussion {
              id
            }
          }
          createdAt
          updatedAt
          Tags {
            text
          }
        }
      `;
            const result = await Discussion.find({
                where: {
                    id: updatedDiscussionId,
                },
                selectionSet,
            });
            session.close();
            return result[0];
        }
        catch (error) {
            console.error("Error updating discussion:", error);
            throw new Error(`Failed to update discussion. ${error.message}`);
        }
    };
};
export default getResolver;
