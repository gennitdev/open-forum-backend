import { createEventChannelQuery } from "../cypher/cypherQueries.js";
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
/**
 * Function to create events from an input array.
 */
export const createEventsFromInput = async (Event, driver, input) => {
    if (!input || input.length === 0) {
        throw new Error("Input cannot be empty");
    }
    const session = driver.session();
    const events = [];
    try {
        for (const { eventCreateInput, channelConnections } of input) {
            if (!channelConnections || channelConnections.length === 0) {
                console.warn("Skipping event creation: No channels provided");
                continue;
            }
            try {
                const response = await Event.create({
                    input: [eventCreateInput],
                    selectionSet: `{ events ${selectionSet} }`,
                });
                const newEvent = response.events[0];
                const newEventId = newEvent.id;
                // Link the event to channels
                for (const channelUniqueName of channelConnections) {
                    try {
                        await session.run(createEventChannelQuery, {
                            eventId: newEventId,
                            channelUniqueName,
                        });
                    }
                    catch (error) {
                        if (error.message.includes("Constraint validation failed")) {
                            console.warn(`Skipping duplicate EventChannel: ${channelUniqueName}`);
                            continue;
                        }
                        else {
                            throw error;
                        }
                    }
                }
                // Refetch the event with all related data
                const fetchedEvent = await Event.find({
                    where: {
                        id: newEventId,
                    },
                    selectionSet,
                });
                events.push(fetchedEvent[0]);
            }
            catch (error) {
                if (error.message.includes("Constraint validation failed")) {
                    console.warn("Skipping event creation due to constraint validation failure");
                    continue;
                }
                else {
                    console.error("Error creating event, skipping:", error.message);
                    continue;
                }
            }
        }
    }
    catch (error) {
        console.error("Unexpected error during event creation:", error.message);
    }
    finally {
        session.close();
    }
    console.log("Created events:", events);
    return events;
};
/**
 * Main resolver that uses createEventsFromInput
 */
const getResolver = (input) => {
    const { Event, driver } = input;
    return async (parent, args, context, info) => {
        const { input } = args;
        try {
            // Use the extracted function to create events
            const events = await createEventsFromInput(Event, driver, input);
            return events;
        }
        catch (error) {
            console.error(error);
            throw new Error(`An error occurred while creating events: ${error.message}`);
        }
    };
};
export default getResolver;
