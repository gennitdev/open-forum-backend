const getResolver = ({ DiscussionChannel, driver }) => {
  return async (parent, args, context, info) => {
    const session = driver.session();
    const { id } = args;

    try {
      // Fetch the count of UpvotedByUsers related to the DiscussionChannel
      const result = await session.run(
        `
        MATCH (d:DiscussionChannel { id: $id })<-[:UPVOTED_DISCUSSION]-()
        RETURN COUNT(*) as upvoteCount
      `,
        { id }
      );

      const count = result.records[0].get("upvoteCount").toNumber();

      // Update the DiscussionChannel node with the fetched count
      await session.run(
        `
        MATCH (d:DiscussionChannel { id: $id })
        SET d.upvoteCount = $count
        RETURN d
      `,
        { id, count }
      );

      const selectionSet = `
        {
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
      `;

      const updatedDiscussionChannel = await DiscussionChannel.find({
        where: {
          id,
        },
        selectionSet,
      });

      return updatedDiscussionChannel[0];
    } catch (error) {
      console.error(error);
      throw new Error("Error updating upvote count.");
    } finally {
      session.close();
    }
  };
};

module.exports = getResolver;
