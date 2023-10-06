// creates DiscussionChannel nodes to link the new discussion with channels.
const createDiscussionChannelQuery = `
MATCH (d:Discussion {id: $discussionId}), (c:Channel {uniqueName: $channelUniqueName}), (u:User {username: $upvotedBy})
MERGE (dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
ON CREATE SET dc.id = apoc.create.uuid(), dc.upvoteCount = 1, dc.createdAt = datetime()
MERGE (dc)-[:POSTED_IN_CHANNEL]->(d) 
MERGE (dc)-[:POSTED_IN_CHANNEL]->(c)
MERGE (u)-[:UPVOTED_DISCUSSION]->(dc)
MERGE (dc)-[:UPVOTED_DISCUSSION]->(u)
RETURN dc, d, c, u
`;

const createEventChannelQuery = `
MATCH (e:Event {id: $eventId}), (c:Channel {uniqueName: $channelUniqueName})
MERGE (ec:EventChannel {eventId: $eventId, channelUniqueName: $channelUniqueName})
ON CREATE SET ec.id = apoc.create.uuid(), ec.createdAt = datetime()
MERGE (ec)-[:POSTED_IN_CHANNEL]->(e)
MERGE (ec)-[:POSTED_IN_CHANNEL]->(c)
RETURN ec, e, c
`;

// creates DiscussionChannel nodes to link the updated discussion with channels.

// - If a DiscussionChannel for the combination of discussionId and channelUniqueName
//   doesn't exist, it'll be created and linked to both Discussion and Channel.
// - If a DiscussionChannel for the combination of discussionId and channelUniqueName
//   does exist and the connection to the Discussion was severed earlier, it'll
//   re-establish that connection.
// - If a DiscussionChannel for the combination of discussionId and channelUniqueName
//   does exist and is already properly connected to the Discussion, the query will
//   have no effect on that particular connection.
const updateDiscussionChannelQuery = `
MATCH (d:Discussion {id: $discussionId}), (c:Channel {uniqueName: $channelUniqueName})
MERGE (dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
ON CREATE SET dc.id = apoc.create.uuid(), dc.createdAt = datetime()
MERGE (dc)-[:POSTED_IN_CHANNEL]->(c)
WITH d, dc, c
MERGE (dc)-[:POSTED_IN_CHANNEL]->(d)
RETURN dc, d, c
`;

// Deletes the connection between the discussion and the channel.
const severConnectionBetweenDiscussionAndChannelQuery = `
MATCH (d:Discussion {id: $discussionId})<-[r:POSTED_IN_CHANNEL]-(dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
DELETE r
`;

module.exports = {
  createDiscussionChannelQuery,
  updateDiscussionChannelQuery,
  severConnectionBetweenDiscussionAndChannelQuery,
};
