MATCH (parentComment:Comment { id: $commentId })<-[:IS_REPLY_TO]-(child:Comment)

// OPTIONAL MATCHES to get related details
OPTIONAL MATCH (child)<-[:AUTHORED_COMMENT]-(author:User)
OPTIONAL MATCH (child)<-[:UPVOTED_COMMENT]-(upvoter:User)
OPTIONAL MATCH (child)<-[:DOWNVOTED_COMMENT]-(downvoter:ModerationProfile)

// Calculations for the sorting formulae
WITH child, author, 
     COLLECT(DISTINCT upvoter) AS UpvotedByUsers,
     COLLECT(DISTINCT downvoter) AS DownvotedByModerators,
     duration.between(child.createdAt, datetime()).months + 
     duration.between(child.createdAt, datetime()).days / 30.0 AS ageInMonths,
     coalesce(child.weightedVotesCount, 0) AS weightedVotesCount

WITH child, author, UpvotedByUsers, DownvotedByModerators, ageInMonths, weightedVotesCount,
     10000 * log10(weightedVotesCount + 1) / ((ageInMonths + 2) ^ 1.8) AS hotRank


// Structure the return data
RETURN {
    id: child.id,
    text: child.text,
    emoji: child.emoji,
    weightedVotesCount: child.weightedVotesCount,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
    CommentAuthor: {
        username: author.username,
        discussionKarma: author.discussionKarma,
        commentKarma: author.commentKarma,
        createdAt: author.createdAt
    },
    UpvotedByUsers: [user IN UpvotedByUsers | user{.*, createdAt: toString(user.createdAt)}],
    UpvotedByUsersAggregate: {
        count: SIZE(UpvotedByUsers)
    },
    DownvotedByModerators: [mod IN DownvotedByModerators | mod{.*, createdAt: toString(mod.createdAt)}],
    DownvotedByModeratorsAggregate: {
        count: SIZE(DownvotedByModerators)
    }
} AS ChildComments, weightedVotesCount, hotRank

ORDER BY 
    CASE WHEN $sortOption = "top" THEN weightedVotesCount END DESC,
    CASE WHEN $sortOption = "hot" THEN hotRank END DESC,
    child.createdAt DESC

SKIP toInteger($offset)
LIMIT toInteger($limit)
