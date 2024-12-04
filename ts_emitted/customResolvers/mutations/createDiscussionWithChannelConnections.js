import { createDiscussionChannelQuery } from "../cypher/cypherQueries.js";
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
      Channel {
        uniqueName
      }
      Discussion {
        id
      }
      UpvotedByUsers {
        username
      }
      UpvotedByUsersAggregate {
        count
      }
    }
    createdAt
    updatedAt
    Tags {
      text
    }
  }
`;
/**
 * Function to create discussions from an input array.
 */
export const createDiscussionsFromInput = async (Discussion, driver, input) => {
    if (!input || input.length === 0) {
        throw new Error("Input cannot be empty");
    }
    console.log("Creating discussions with input:", input);
    const session = driver.session();
    const discussions = [];
    try {
        for (const { discussionCreateInput, channelConnections } of input) {
            console.log("Creating discussion with channels:", discussionCreateInput, channelConnections);
            if (!channelConnections || channelConnections.length === 0) {
                throw new Error("At least one channel must be selected");
            }
            const response = await Discussion.create({
                input: [discussionCreateInput],
                selectionSet: `{ discussions ${selectionSet} }`,
            });
            console.log("Discussion created:", response);
            const newDiscussion = response.discussions[0];
            const newDiscussionId = newDiscussion.id;
            // Link the discussion to channels
            for (const channelUniqueName of channelConnections) {
                try {
                    console.log('running create DC with arguments ,', {
                        discussionId: newDiscussionId,
                        channelUniqueName,
                        upvotedBy: newDiscussion.Author.username,
                    });
                    await session.run(createDiscussionChannelQuery, {
                        discussionId: newDiscussionId,
                        channelUniqueName,
                        upvotedBy: newDiscussion.Author.username,
                    });
                }
                catch (error) {
                    if (error.message.includes("Constraint validation failed")) {
                        console.warn(`Skipping duplicate DiscussionChannel: ${channelUniqueName}`);
                        continue;
                    }
                    else {
                        throw error;
                    }
                }
            }
            // Refetch the discussion with all related data
            const fetchedDiscussion = await Discussion.find({
                where: {
                    id: newDiscussionId,
                },
                selectionSet,
            });
            console.log("Fetched discussion:", fetchedDiscussion[0]);
            discussions.push(fetchedDiscussion[0]);
        }
    }
    catch (error) {
        console.error("Error creating discussions:", error);
        throw new Error(`Failed to create discussions: ${error.message}`);
    }
    finally {
        session.close();
    }
    return discussions;
};
/**
 * Main resolver that uses createDiscussionsFromInput
 */
const getResolver = (input) => {
    const { Discussion, driver } = input;
    return async (parent, args, context, info) => {
        const { input } = args;
        try {
            // Use the extracted function to create discussions
            const discussions = await createDiscussionsFromInput(Discussion, driver, input);
            console.log("Discussions created in resolver:", discussions);
            return discussions;
        }
        catch (error) {
            console.error(error);
            throw new Error(`An error occurred while creating discussions: ${error.message}`);
        }
    };
};
export default getResolver;
