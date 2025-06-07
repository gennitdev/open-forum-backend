type Args = {
  commentId: string;
};

type Input = {
  Comment: any;
  driver: any;
};

const getResolver = (input: Input) => {
  const { Comment, driver } = input;

  return async (parent: any, args: Args, context: any, info: any) => {
    const { commentId } = args;
    const { username } = context.user;

    if (!username) {
      throw new Error("Authentication required");
    }

    const session = driver.session();

    try {
      // Connect user to SubscribedToNotifications
      await session.run(
        `
        MATCH (c:Comment {id: $commentId})
        MATCH (u:User {username: $username})
        MERGE (u)-[:SUBSCRIBED_TO_NOTIFICATIONS]->(c)
        `,
        { commentId, username }
      );

      // Return the updated Comment
      const result = await Comment.find({
        where: { id: commentId },
        selectionSet: `{
          id
          text
          createdAt
          SubscribedToNotifications {
            username
          }
        }`
      });

      return result[0];
    } catch (error: any) {
      console.error("Error subscribing to comment:", error);
      throw new Error(`Failed to subscribe to comment: ${error.message}`);
    } finally {
      session.close();
    }
  };
};

export default getResolver;