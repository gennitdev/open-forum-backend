MATCH (dc:DiscussionChannel { channelUniqueName: $channelUniqueName })

// Use the variable $startOfTimeFrame to filter results by time frame
WHERE ($startOfTimeFrame IS NULL OR datetime(dc.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis)
AND ($searchInput = "" OR EXISTS { MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion) WHERE d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput })
AND (SIZE($selectedTags) = 0 OR EXISTS { MATCH (d)-[:HAS_TAG]->(tag:Tag) WHERE tag.text IN $selectedTags })

OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(upvoter:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)

WITH dc, d, author, tag,
     COLLECT(c) AS comments,
     COLLECT(DISTINCT tag.text) AS tagsText,
     COLLECT(DISTINCT upvoter) AS UpvotedByUsers,
     coalesce(dc.weightedVotesCount, 0.0) AS weightedVotesCount,
     // Compute the age in months from the createdAt timestamp.
     duration.between(dc.createdAt, datetime()).months + 
     duration.between(dc.createdAt, datetime()).days / 30.0 AS ageInMonths,
     10000 * log10(weightedVotesCount + 1) / ((ageInMonths + 2) ^ 1.8) AS hotRank

WITH dc, d, author, tagsText, UpvotedByUsers, weightedVotesCount, comments, hotRank,
     CASE 
        WHEN $ordering = "hot" THEN hotRank 
        ELSE weightedVotesCount 
     END AS finalOrder

RETURN {
    id: dc.id,
    discussionId: d.id,
    createdAt: dc.createdAt,
    channelUniqueName: dc.channelUniqueName,
    weightedVotesCount: weightedVotesCount,
    CommentsAggregate: {
        count: SIZE(comments)
    },
    UpvotedByUsers: [up in UpvotedByUsers | { username: up.username }],
    UpvotedByUsersCount: {
        count: SIZE(UpvotedByUsers) 
    },
    Discussion: {
        id: d.id,
        title: d.title,
        body: d.body,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        Author: CASE
                  WHEN author IS NULL THEN null
                  ELSE {
                      username: author.username,
                      createdAt: author.createdAt,
                      discussionKarma: author.discussionKarma,
                      commentKarma: author.commentKarma
                  }
                END,
        Tags: [t IN tagsText | {text: t}]
    },
    Channel: {
        uniqueName: dc.channelUniqueName
    }
} AS DiscussionChannel

ORDER BY 
    finalOrder DESC, 
    dc.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
