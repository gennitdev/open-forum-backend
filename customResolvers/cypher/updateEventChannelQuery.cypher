MATCH (e:Event {id: $eventId}), (c:Channel {uniqueName: $channelUniqueName})
MERGE (ec:EventChannel {eventId: $eventId, channelUniqueName: $channelUniqueName})
ON CREATE SET ec.id = apoc.create.uuid(), ec.createdAt = datetime()
MERGE (ec)-[:POSTED_IN_CHANNEL]->(c)
WITH e, ec, c
MERGE (ec)-[:POSTED_IN_CHANNEL]->(e)
RETURN ec, e, c