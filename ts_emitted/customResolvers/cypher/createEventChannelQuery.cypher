MATCH (e:Event {id: $eventId}), (c:Channel {uniqueName: $channelUniqueName})
MERGE (ec:EventChannel {eventId: $eventId, channelUniqueName: $channelUniqueName})
ON CREATE SET 
    ec.id = apoc.create.uuid(),
    ec.createdAt = datetime()
MERGE (ec)-[:POSTED_IN_CHANNEL]->(e)
MERGE (ec)-[:POSTED_IN_CHANNEL]->(c)
RETURN {
    id: ec.id,
    eventId: ec.eventId,
    channelUniqueName: ec.channelUniqueName,
    createdAt: ec.createdAt,
    Event: e {.*},
    Channel: c {.*}
} as eventChannel