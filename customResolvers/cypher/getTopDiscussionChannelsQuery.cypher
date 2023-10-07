MATCH (dc:DiscussionChannel { channelUniqueName: $channelUniqueName })

// Use the variable $startOfTimeFrame to filter results by time frame
WHERE ($startOfTimeFrame IS NULL OR datetime(dc.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis)

// We want the Discussion to match the search input
MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
WHERE ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)
AND (SIZE($selectedTags) = 0 OR EXISTS { MATCH (d)-[:HAS_TAG]->(tag:Tag) WHERE tag.text IN $selectedTags })


// Remaining optional matches
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(upvoter:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)


WITH dc, d, author, tag,
     COLLECT(c) AS comments,
     COLLECT(DISTINCT tag.text) AS tagsText,
     COLLECT(DISTINCT upvoter) AS UpvotedByUsers,
     // The ONLY reason we are using a custom cypher query instead of
     // an auto-generated resolver is because we need to treat a null
     // weightedVotesCount as 0.0.
     coalesce(dc.weightedVotesCount, 0.0) AS weightedVotesCount

WITH dc.id AS id, 
     d.id AS discussionId,
     dc.createdAt AS createdAt,
     dc.channelUniqueName AS channelUniqueName,
     weightedVotesCount AS weightedVotesCount,
     COUNT(DISTINCT comments) AS commentCount,
     [up in UpvotedByUsers | { username: up.username }] AS UpvotedByUsers,
     {
        count: SIZE(UpvotedByUsers) 
     } AS UpvotedByUsersCount,
     d.title AS title,
     d.body AS body,
     d.createdAt AS discussionCreatedAt,
     d.updatedAt AS updatedAt,
     dc.channelUniqueName AS uniqueName,
     [x IN COLLECT(tag.text) WHERE x IS NOT NULL] AS tagsText, 
     author

RETURN {
    id: id,
    discussionId: discussionId,
    createdAt: createdAt,
    channelUniqueName: channelUniqueName,
    weightedVotesCount: weightedVotesCount,
    CommentsAggregate: {
        count: commentCount
    },
    UpvotedByUsers: UpvotedByUsers,
    Discussion: {
        id: discussionId,
        title: title,
        body: body,
        createdAt: discussionCreatedAt,
        updatedAt: updatedAt,
        Author: {
            username: author.username,
            createdAt: author.createdAt,
            discussionKarma: author.discussionKarma,
            commentKarma: author.commentKarma
        },
        Tags: [t IN tagsText | {text: t}]
    },
    UpvotedByUsersCount: UpvotedByUsersCount,
    Channel: {
        uniqueName: uniqueName
    }
} AS DiscussionChannel
    
ORDER BY weightedVotesCount DESC, discussionCreatedAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
