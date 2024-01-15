import { updateEventChannelQuery, severConnectionBetweenEventAndChannelQuery } from "../cypher/cypherQueries";
const getResolver = (input) => {
    const { Event, driver } = input;
    return async (parent, args, context, info) => {
        const { eventWhere, eventUpdateInput, channelConnections, channelDisconnections, } = args;
        if (!channelConnections || channelConnections.length === 0) {
            throw new Error("At least one channel must be selected. To remove an event from all channels, use the deleteEvent mutation.");
        }
        try {
            // Update the event
            // ignore TS errors
            // @ts-ignore
            await Event.update({
                where: eventWhere,
                update: eventUpdateInput,
            });
            const updatedEventId = eventWhere.id;
            const session = driver.session();
            // Update the channel connections
            for (let i = 0; i < channelConnections.length; i++) {
                const channelUniqueName = channelConnections[i];
                // For each channel connection, create a EventChannel node
                // if one does not already exist.
                // Join the EventChannel to the Event and Channel nodes.
                // If there was an existing one, join that. If we just created one,
                // join that.
                await session.run(updateEventChannelQuery, {
                    eventId: updatedEventId,
                    channelUniqueName: channelUniqueName,
                });
            }
            // Update the channel disconnections
            for (let i = 0; i < channelDisconnections.length; i++) {
                const channelUniqueName = channelDisconnections[i];
                // For each channel disconnection, sever the connection between
                // the Event and the EventChannel node.
                // We intentionally do not delete the EventChannel node
                // because it contains comments that are authored by other users
                // than the event poster, and the event poster should
                // not have permission to delete those comments.
                await session.run(severConnectionBetweenEventAndChannelQuery, {
                    eventId: updatedEventId,
                    channelUniqueName: channelUniqueName,
                });
            }
            // Refetch the newly created event with the channel connections
            // and disconnections so that we can return it.
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
            // @ts-ignore
            const result = await Event.find({
                where: {
                    id: updatedEventId,
                },
                selectionSet,
            });
            session.close();
            return result[0];
        }
        catch (error) {
            console.error("Error updating event:", error);
            throw new Error(`Failed to update event. ${error.message}`);
        }
    };
};
export default getResolver;
