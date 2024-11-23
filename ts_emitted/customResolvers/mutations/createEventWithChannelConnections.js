import { createEventChannelQuery } from "../cypher/cypherQueries.js";
const getResolver = (input) => {
    const { Event, driver } = input;
    return async (parent, args, context, info) => {
        const { eventCreateInput, channelConnections } = args;
        console.log("eventCreateInput", eventCreateInput);
        console.log("channelConnections", channelConnections);
        if (!channelConnections || channelConnections.length === 0) {
            console.error("At least one channel must be selected");
            throw new Error("At least one channel must be selected");
        }
        const selectionSet = `
        {
          id
          title
          description
          startTime
          startTimeDayOfWeek
          startTimeHourOfDay
          endTime
          locationName
          address
          virtualEventUrl
          startTimeDayOfWeek
          canceled
          cost
          isAllDay
          isHostedByOP
          coverImageURL
          Poster {
            username
          }
          EventChannels {
            id
            createdAt
            channelUniqueName
            eventId
            Channel {
              uniqueName
            }
            Event {
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
            const response = await Event.create({
                input: [eventCreateInput],
                selectionSet: `{ events ${selectionSet} }`,
            });
            const newEvent = response.events[0];
            const newEventId = newEvent.id;
            const session = driver.session();
            for (let i = 0; i < channelConnections.length; i++) {
                const channelUniqueName = channelConnections[i];
                await session.run(createEventChannelQuery, {
                    eventId: newEventId,
                    channelUniqueName: channelUniqueName,
                });
            }
            // Refetch the newly created event with the channel connections
            // so that we can return it.
            const result = await Event.find({
                where: {
                    id: newEventId,
                },
                selectionSet,
            });
            session.close();
            return result[0];
        }
        catch (error) {
            console.error("Error creating event:", error);
            throw new Error(`Failed to create event. ${error.message}`);
        }
    };
};
export default getResolver;
