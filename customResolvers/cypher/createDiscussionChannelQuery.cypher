MATCH (d:Discussion {id: $discussionId}), (c:Channel {uniqueName: $channelUniqueName}), (u:User {username: $upvotedBy})
OPTIONAL MATCH (dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
WITH d, c, u, dc
WHERE dc IS NULL  // Skip creation if it already exists
CREATE (newDc:DiscussionChannel {
    discussionId: $discussionId, 
    channelUniqueName: $channelUniqueName, 
    id: apoc.create.uuid(), 
    createdAt: datetime(),
    archived: false
})
MERGE (newDc)-[:POSTED_IN_CHANNEL]->(d)
MERGE (newDc)-[:POSTED_IN_CHANNEL]->(c)
MERGE (u)-[:UPVOTED_DISCUSSION]->(newDc)
MERGE (u)-[:SUBSCRIBED_TO_NOTIFICATIONS]->(newDc) 
WITH newDc, d, c, u
WITH newDc, d, c, collect(u {username: u.username}) as upvotedByUsers
RETURN {
    id: newDc.id,
    discussionId: newDc.discussionId,
    channelUniqueName: newDc.channelUniqueName,
    createdAt: newDc.createdAt,
    Discussion: d {.*},
    Channel: c {.*},
    UpvotedByUsers: upvotedByUsers
} as discussionChannel