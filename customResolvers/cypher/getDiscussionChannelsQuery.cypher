// Calculate the aggregate discussion count first with tag handling
MATCH (dcAgg:DiscussionChannel { channelUniqueName: $channelUniqueName })
WHERE ($startOfTimeFrame IS NULL OR datetime(dcAgg.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis)
AND ($searchInput = "" OR EXISTS { MATCH (dcAgg)-[:POSTED_IN_CHANNEL]->(dAgg:Discussion) WHERE dAgg.title CONTAINS $searchInput OR dAgg.body CONTAINS $searchInput })
AND (SIZE($selectedTags) = 0 OR EXISTS { MATCH (dAgg)-[:HAS_TAG]->(tagAgg:Tag) WHERE tagAgg.text IN $selectedTags })
WITH COUNT(DISTINCT dAgg) AS aggregateDiscussionCount, dcAgg

// Proceed with fetching the discussions and other details
MATCH (dc:DiscussionChannel { channelUniqueName: $channelUniqueName })
WHERE ID(dc) = ID(dcAgg)
OPTIONAL MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(upvoter:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)

WITH dc, d, author, COLLECT(c) AS comments, 
     COLLECT(DISTINCT tag.text) AS tagsText, 
     COLLECT(DISTINCT upvoter) AS UpvotedByUsers, 
     COALESCE(dc.weightedVotesCount, 0.0) AS weightedVotesCount, 
     duration.between(dc.createdAt, datetime()).months + 
     duration.between(dc.createdAt, datetime()).days / 30.0 AS ageInMonths, 
     10000 * log10(weightedVotesCount + 1) / ((ageInMonths + 2) ^ 1.8) AS hotRank, 
     aggregateDiscussionCount

WITH dc, d, author, tagsText, UpvotedByUsers, weightedVotesCount, comments, hotRank, 
     CASE 
        WHEN $ordering = "hot" THEN hotRank 
        ELSE weightedVotesCount 
     END AS finalOrder, 
     aggregateDiscussionCount

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
    },
    aggregateDiscussionCount: aggregateDiscussionCount // Aggregate count added to the result
} AS DiscussionChannel

ORDER BY 
    finalOrder DESC, 
    dc.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
