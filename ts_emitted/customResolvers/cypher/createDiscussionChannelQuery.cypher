MATCH (d:Discussion {id: $discussionId}), (c:Channel {uniqueName: $channelUniqueName}), (u:User {username: $upvotedBy})
OPTIONAL MATCH (dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
WITH d, c, u, dc
WHERE dc IS NULL  // Skip creation if it already exists
CREATE (newDc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName, id: apoc.create.uuid(), createdAt: datetime()})
MERGE (newDc)-[:POSTED_IN_CHANNEL]->(d)
MERGE (newDc)-[:POSTED_IN_CHANNEL]->(c)
MERGE (u)-[:UPVOTED_DISCUSSION]->(newDc)
RETURN newDc, d, c, u
