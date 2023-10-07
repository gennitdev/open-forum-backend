MATCH (dc:DiscussionChannel { id: $discussionChannelId })-[:CONTAINS_COMMENT]->(c:Comment)
WHERE c.isRootComment = true

OPTIONAL MATCH (c)<-[:AUTHORED_COMMENT]-(author:User)
OPTIONAL MATCH (c)-[:IS_REPLY_TO]->(parent:Comment)
OPTIONAL MATCH (c)<-[:IS_REPLY_TO]-(child:Comment)
OPTIONAL MATCH (c)<-[:UPVOTED_COMMENT]-(upvoter:User)
OPTIONAL MATCH (c)<-[:DOWNVOTED_COMMENT]-(downvoter:ModerationProfile)

WITH c, author, parent,
     COLLECT(DISTINCT upvoter{.*, createdAt: toString(upvoter.createdAt)}) AS UpvotedByUsers, 
     COLLECT(DISTINCT downvoter{.*, createdAt: toString(downvoter.createdAt)}) AS DownvotedByModerators,
     COLLECT(DISTINCT parent.id) AS parentIds,
     COLLECT(DISTINCT CASE WHEN child IS NOT NULL THEN {id: child.id, text: child.text} ELSE null END) AS NonFilteredChildComments,
     // Compute the age in months from the createdAt timestamp.
     duration.between(c.createdAt, datetime()).months + 
     duration.between(c.createdAt, datetime()).days / 30.0 AS ageInMonths,
     10000 * log10(coalesce(c.weightedVotesCount, 0) + 1) / ((ageInMonths + 2) ^ 1.8) AS hotRank

WITH c, author, parent, UpvotedByUsers, DownvotedByModerators, parentIds, [comment IN NonFilteredChildComments WHERE comment IS NOT NULL] AS ChildComments, 
     CASE 
        WHEN $sortOption = "hot" THEN hotRank 
        ELSE coalesce(c.weightedVotesCount, 0)
     END AS finalOrder

RETURN {
    id: c.id,
    text: c.text,
    emoji: c.emoji,
    weightedVotesCount: coalesce(c.weightedVotesCount, 0),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    CommentAuthor: {
        username: author.username,
        discussionKarma: author.discussionKarma,
        commentKarma: author.commentKarma,
        createdAt: author.createdAt
    },
    ParentComment: CASE WHEN SIZE(parentIds) > 0 THEN {id: parentIds[0]} ELSE null END,
    UpvotedByUsers: UpvotedByUsers,
    UpvotedByUsersAggregate: {
        count: SIZE(UpvotedByUsers)
    },
    DownvotedByModerators: DownvotedByModerators,
    DownvotedByModeratorsAggregate: {
        count: SIZE(DownvotedByModerators)
    },
    ChildComments: CASE WHEN SIZE(ChildComments) > 0 THEN ChildComments ELSE [] END,
    ChildCommentsAggregate: {
        count: SIZE(ChildComments)
    }
} AS comment
ORDER BY finalOrder DESC, c.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
