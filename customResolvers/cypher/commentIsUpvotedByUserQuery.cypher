MATCH (c:Comment { id: $commentId })
OPTIONAL MATCH (c)-[:UPVOTED_COMMENT]-(u:User)
WITH c, collect(u.username) as upvotedUsers
RETURN { upvotedByUser: CASE WHEN $username IN upvotedUsers THEN true ELSE false END } as result
