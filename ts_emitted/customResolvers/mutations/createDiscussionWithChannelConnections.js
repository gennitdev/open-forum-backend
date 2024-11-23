// The reason why we cannot use the auto-generated resolver
// to create a Discussion with DiscussionChannels already linked
// is because the creation of the DiscussionChannel nodes
// requires a discussion ID.
// We do not have the discussion ID until the Discussion is created.
// And the discussion ID is required to create the DiscussionChannel nodes.
// in order to enforce a uniqueness constraint between one discussion
// and one channel.
// The reason why we have to create DiscussionChannel nodes
// with a discussion ID, channel uniqueName, and separate relationships
// to the Channel and Discussion nodes is because we cannot enforce
// a uniqueness constraint based on relationships alone. That constraint
// requires the IDs.
// Therefore, we have to create the Discussion first, then create the
// DiscussionChannel nodes that are linked to the Discussion and Channel nodes.
// DiscussionChannel schema for reference:
// type DiscussionChannel {
//   id: ID! @id
//   discussionId: ID! # used for uniqueness constraint
//   channelUniqueName: String! # used for uniqueness constraint
//   Discussion: Discussion
//     @relationship(type: "POSTED_IN_CHANNEL", direction: OUT)
//   Channel: Channel @relationship(type: "POSTED_IN_CHANNEL", direction: OUT)
//    ...other fields
// }
const getResolver = (input) => {
    const { Discussion, driver } = input;
    return async (parent, args, context, info) => {
        const { discussionCreateInput, channelConnections } = args;
        if (!channelConnections || channelConnections.length === 0) {
            throw new Error("At least one channel must be selected");
        }
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
                createdAt
                channelUniqueName
                discussionId
                UpvotedByUsers {
                  username
                }
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
        const session = driver.session();
        try {
            // Start a new transaction
            const txResult = await session.executeWrite(async (tx) => {
                // First create the discussion
                const response = await Discussion.create({
                    input: [discussionCreateInput],
                    selectionSet: `{ discussions ${selectionSet} }`,
                });
                const newDiscussion = response.discussions[0];
                const newDiscussionId = newDiscussion.id;
                // Create each channel connection in the same transaction
                for (const channelUniqueName of channelConnections) {
                    try {
                        // First check if the DiscussionChannel already exists
                        const checkExisting = await tx.run(`
                  MATCH (dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
                  RETURN dc
                  `, { discussionId: newDiscussionId, channelUniqueName });
                        if (checkExisting.records.length === 0) {
                            // Only create if it doesn't exist
                            await tx.run(`
                    MATCH (d:Discussion {id: $discussionId}), (c:Channel {uniqueName: $channelUniqueName}), (u:User {username: $upvotedBy})
                    CREATE (dc:DiscussionChannel {
                      id: apoc.create.uuid(),
                      discussionId: $discussionId,
                      channelUniqueName: $channelUniqueName,
                      createdAt: datetime(),
                      locked: false,
                      weightedVotesCount: 0.0
                    })
                    MERGE (dc)-[:POSTED_IN_CHANNEL]->(d)
                    MERGE (dc)-[:POSTED_IN_CHANNEL]->(c)
                    MERGE (u)-[:UPVOTED_DISCUSSION]->(dc)
                    MERGE (dc)-[:UPVOTED_DISCUSSION]->(u)
                    RETURN dc
                    `, {
                                discussionId: newDiscussionId,
                                channelUniqueName: channelUniqueName,
                                upvotedBy: newDiscussion.Author.username,
                            });
                        }
                    }
                    catch (channelError) {
                        console.warn(`Skipping duplicate channel connection for ${channelUniqueName}:`, channelError.message);
                        continue; // Skip this channel and continue with others
                    }
                }
                return newDiscussion;
            });
            // Refetch the newly created discussion with all its connections
            const result = await Discussion.find({
                where: {
                    id: txResult.id,
                },
                selectionSet,
            });
            return result[0];
        }
        catch (error) {
            console.error("Error creating discussion:", error);
            throw new Error(`Failed to create discussion. ${error.message}`);
        }
        finally {
            await session.close();
        }
    };
};
export default getResolver;
