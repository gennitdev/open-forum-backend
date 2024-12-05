MATCH (dc:DiscussionChannel { id: $discussionChannelId })
OPTIONAL MATCH (u:User)-[:UPVOTED_DISCUSSION]->(dc)
WITH dc, collect(u.username) as upvotedUsers
RETURN { upvotedByUser: CASE WHEN $username IN upvotedUsers THEN true ELSE false END } as result