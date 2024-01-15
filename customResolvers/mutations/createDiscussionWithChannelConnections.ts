import { createDiscussionChannelQuery } from "../cypher/cypherQueries";
import { DiscussionCreateInput } from "../../src/generated/graphql";

type Args = {
  discussionCreateInput: DiscussionCreateInput;
  channelConnections: string[];
};

type Input = {
  Discussion: any;
  driver: any;
};

const getResolver = (input: Input) => {
  const {Discussion, driver} = input;
  return async (parent: any, args: Args, context: any, info: any) => {
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

    try {
      const response = await Discussion.create({
        input: [discussionCreateInput],
        selectionSet: `{ discussions ${selectionSet} }`
      });
      const newDiscussion = response.discussions[0];

      const newDiscussionId = newDiscussion.id;

      const session = driver.session();

      for (let i = 0; i < channelConnections.length; i++) {
        const channelUniqueName = channelConnections[i];

        await session.run(createDiscussionChannelQuery, {
          discussionId: newDiscussionId,
          channelUniqueName: channelUniqueName,
          upvotedBy: newDiscussion.Author.username,
        });
      }

      // Refetch the newly created discussion with the channel connections
      // so that we can return it.
      const result = await Discussion.find({
        where: {
          id: newDiscussionId,
        },
        selectionSet,
      });
      session.close();

      return result[0];
    } catch (error) {
      console.error("Error creating discussion:", error);
      throw new Error(`Failed to create discussion. ${error.message}`);
    }
  };
};
export default getResolver;
