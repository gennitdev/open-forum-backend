MATCH (e:Event {id: $eventId}), (c:Channel {uniqueName: $channelUniqueName}), (u:User {username: $poster})
OPTIONAL MATCH (ec:EventChannel {eventId: $eventId, channelUniqueName: $channelUniqueName})
WITH e, c, u, ec
WHERE ec IS NULL  // Skip creation if it already exists
CREATE (newEc:EventChannel {
    eventId: $eventId, 
    channelUniqueName: $channelUniqueName, 
    id: apoc.create.uuid(), 
    createdAt: datetime(),
    archived: false
})
MERGE (newEc)-[:POSTED_IN_CHANNEL]->(e)
MERGE (newEc)-[:POSTED_IN_CHANNEL]->(c)
// Only subscribe to notifications if user has opted in
FOREACH (ignoreMe IN CASE WHEN u.notifyOnReplyToEventByDefault = true THEN [1] ELSE [] END |
    MERGE (u)-[:SUBSCRIBED_TO_NOTIFICATIONS]->(e)
) 
RETURN {
    id: newEc.id,
    eventId: newEc.eventId,
    channelUniqueName: newEc.channelUniqueName,
    createdAt: newEc.createdAt,
    archived: newEc.archived,
    Event: e {.*},
    Channel: c {.*}
} as eventChannel