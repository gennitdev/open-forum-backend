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

    console.log('=== DEBUG: subscribeToDiscussionChannel called with:', {
      discussionChannelId,
      username
    });

    if (!username) {
      console.error('=== DEBUG ERROR: Authentication required for subscription');
      throw new Error("Authentication required");
    }

    const session = driver.session();

    try {
      console.log('=== DEBUG: Creating subscription relationship');
      
      // Connect user to SubscribedToNotifications
      const subscriptionResult = await session.run(
        `
        MATCH (dc:DiscussionChannel {id: $discussionChannelId})
        MATCH (u:User {username: $username})
        MERGE (u)-[:SUBSCRIBED_TO_NOTIFICATIONS]->(dc)
        RETURN dc.id as discussionChannelId, u.username as subscribedUsername
        `,
        { discussionChannelId, username }
      );
      
      console.log('=== DEBUG: Subscription creation result:', {
        recordsCount: subscriptionResult.records.length,
        firstRecord: subscriptionResult.records[0] ? {
          discussionChannelId: subscriptionResult.records[0].get('discussionChannelId'),
          subscribedUsername: subscriptionResult.records[0].get('subscribedUsername')
        } : null
      });

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

      console.log('=== DEBUG: Subscription successful, returning DiscussionChannel:', {
        id: result[0]?.id,
        subscribedUsersCount: result[0]?.SubscribedToNotifications?.length || 0
      });
      
      return result[0];
    } catch (error: any) {
      console.error('=== DEBUG ERROR: Error subscribing to discussion channel:', error);
      throw new Error(`Failed to subscribe to discussion channel: ${error.message}`);
    } finally {
      session.close();
    }
  };
};

export default getResolver;