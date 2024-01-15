MATCH (d:Discussion {id: $discussionId}), (c:Channel {uniqueName: $channelUniqueName}), (u:User {username: $upvotedBy})
MERGE (dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
ON CREATE SET dc.id = apoc.create.uuid(), dc.createdAt = datetime()
MERGE (dc)-[:POSTED_IN_CHANNEL]->(d) 
MERGE (dc)-[:POSTED_IN_CHANNEL]->(c)
MERGE (u)-[:UPVOTED_DISCUSSION]->(dc)
MERGE (dc)-[:UPVOTED_DISCUSSION]->(u)
RETURN dc, d, c, u