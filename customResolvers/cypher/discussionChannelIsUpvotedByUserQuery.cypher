MATCH (dc:DiscussionChannel { id: $discussionChannelId })
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]-(u:User)
WITH dc, collect(u.username) as upvotedUsers
RETURN { upvotedByUser: CASE WHEN $username IN upvotedUsers THEN true ELSE false END } as result
