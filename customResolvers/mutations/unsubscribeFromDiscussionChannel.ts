type Args = {
  discussionChannelId: string;
};

type Input = {
  DiscussionChannel: any;
  driver: any;
};

const getResolver = (input: Input) => {
  const { DiscussionChannel, driver } = input;

  return async (parent: any, args: Args, context: any, info: any) => {
    const { discussionChannelId } = args;
    const { username } = context.user;

    if (!username) {
      throw new Error("Authentication required");
    }

    const session = driver.session();

    try {
      // Disconnect user from SubscribedToNotifications
      await session.run(
        `
        MATCH (dc:DiscussionChannel {id: $discussionChannelId})
        MATCH (u:User {username: $username})
        OPTIONAL MATCH (u)-[r:SUBSCRIBED_TO_NOTIFICATIONS]->(dc)
        DELETE r
        `,
        { discussionChannelId, username }
      );

      // Return the updated DiscussionChannel
      const result = await DiscussionChannel.find({
        where: { id: discussionChannelId },
        selectionSet: `{
          id
          discussionId
          channelUniqueName
          createdAt
          archived
          SubscribedToNotifications {
            username
          }
        }`
      });

      return result[0];
    } catch (error: any) {
      console.error("Error unsubscribing from discussion channel:", error);
      throw new Error(`Failed to unsubscribe from discussion channel: ${error.message}`);
    } finally {
      session.close();
    }
  };
};

export default getResolver;