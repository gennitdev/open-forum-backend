MATCH (dc:DiscussionChannel { channelUniqueName: $channelUniqueName })

OPTIONAL MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(upvoter:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)

WITH dc, d, author,
     COLLECT(c) AS comments,
     COLLECT(DISTINCT upvoter) AS UpvotedByUsers,
     coalesce(dc.weightedVotesCount, 0.0) AS weightedVotesCount,
     // Compute the age in months from the createdAt timestamp.
     duration.between(dc.createdAt, datetime()).months + 
     duration.between(dc.createdAt, datetime()).days / 30.0 AS ageInMonths

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
     author,
     ageInMonths,
     // Use ageInMonths to calculate the rank.
     10000 * log10(weightedVotesCount + 1) / ((ageInMonths + 2) ^ 1.8) AS rank

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
        }
    },
    UpvotedByUsersCount: UpvotedByUsersCount,
    Channel: {
        uniqueName: uniqueName
    }
} AS DiscussionChannel
    
ORDER BY rank DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
