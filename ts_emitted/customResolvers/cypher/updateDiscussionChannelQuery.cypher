// - If a DiscussionChannel for the combination of discussionId and channelUniqueName
//   doesn't exist, it'll be created and linked to both Discussion and Channel.
// - If a DiscussionChannel for the combination of discussionId and channelUniqueName
//   does exist and the connection to the Discussion was severed earlier, it'll
//   re-establish that connection.
// - If a DiscussionChannel for the combination of discussionId and channelUniqueName
//   does exist and is already properly connected to the Discussion, the query will
//   have no effect on that particular connection.
MATCH (d:Discussion {id: $discussionId}), (c:Channel {uniqueName: $channelUniqueName})
MERGE (dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
ON CREATE SET dc.id = apoc.create.uuid(), dc.createdAt = datetime()
MERGE (dc)-[:POSTED_IN_CHANNEL]->(c)
WITH d, dc, c
MERGE (dc)-[:POSTED_IN_CHANNEL]->(d)
RETURN dc, d, c