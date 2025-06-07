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
      // Connect user to SubscribedToNotifications
      await session.run(
        `
        MATCH (dc:DiscussionChannel {id: $discussionChannelId})
        MATCH (u:User {username: $username})
        MERGE (u)-[:SUBSCRIBED_TO_NOTIFICATIONS]->(dc)
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
      console.error("Error subscribing to discussion channel:", error);
      throw new Error(`Failed to subscribe to discussion channel: ${error.message}`);
    } finally {
      session.close();
    }
  };
};

export default getResolver;