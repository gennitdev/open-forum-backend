MATCH (dc:DiscussionChannel { id: $discussionChannelId })-[:CONTAINS_COMMENT]->(c:Comment)
WHERE c.isRootComment = true

OPTIONAL MATCH (c)<-[:AUTHORED_COMMENT]-(author:User)

RETURN {
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    CommentAuthor: {
        username: author.username
    }
} AS comment
ORDER BY coalesce(c.weightedVotesCount, 0) DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
