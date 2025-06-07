type Args = {
  eventId: string;
};

type Input = {
  Event: any;
  driver: any;
};

const getResolver = (input: Input) => {
  const { Event, driver } = input;

  return async (parent: any, args: Args, context: any, info: any) => {
    const { eventId } = args;
    const { username } = context.user;

    if (!username) {
      throw new Error("Authentication required");
    }

    const session = driver.session();

    try {
      // Connect user to SubscribedToNotifications
      await session.run(
        `
        MATCH (e:Event {id: $eventId})
        MATCH (u:User {username: $username})
        MERGE (u)-[:SUBSCRIBED_TO_NOTIFICATIONS]->(e)
        `,
        { eventId, username }
      );

      // Return the updated Event
      const result = await Event.find({
        where: { id: eventId },
        selectionSet: `{
          id
          title
          description
          createdAt
          SubscribedToNotifications {
            username
          }
        }`
      });

      return result[0];
    } catch (error: any) {
      console.error("Error subscribing to event:", error);
      throw new Error(`Failed to subscribe to event: ${error.message}`);
    } finally {
      session.close();
    }
  };
};

export default getResolver;