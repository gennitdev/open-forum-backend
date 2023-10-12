MATCH (dc:DiscussionChannel { channelUniqueName: $channelUniqueName })
WHERE 
    ($searchInput = "" OR EXISTS { MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion) WHERE d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput })
    AND (CASE WHEN $sortOption = "top" THEN (datetime(dc.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis OR $startOfTimeFrame IS NULL ) ELSE TRUE END)
    AND (
        SIZE($selectedTags) = 0 OR 
        EXISTS { MATCH (dc)-[:POSTED_IN_CHANNEL]->(d)-[:HAS_TAG]->(tag:Tag) WHERE tag.text IN $selectedTags }
    )
    
WITH COLLECT(dc) AS filteredDiscussionChannels
WITH filteredDiscussionChannels

// Fetch the discussions and other details for these channels
UNWIND filteredDiscussionChannels AS dc
MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(upvoter:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)


WITH dc, d, author, COLLECT(c) AS comments, 
     COLLECT(DISTINCT tag.text) AS tagsText, 
     COLLECT(DISTINCT upvoter) AS UpvotedByUsers, 
     COALESCE(dc.weightedVotesCount, 0.0) AS weightedVotesCount,
     duration.between(dc.createdAt, datetime()).months + 
     duration.between(dc.createdAt, datetime()).days / 30.0 AS ageInMonths

WITH dc, d, author, tagsText, UpvotedByUsers, weightedVotesCount, comments,
     10000 * log10(weightedVotesCount + 1) / ((ageInMonths + 2) ^ 1.8) AS hotRank

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
    UpvotedByUsersAggregate: {
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
    CASE WHEN $sortOption = "new" THEN DiscussionChannel.createdAt END DESC,
    CASE WHEN $sortOption = "top" THEN weightedVotesCount END DESC,
    CASE WHEN $sortOption = "hot" THEN hotRank END DESC,
    DiscussionChannel.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
