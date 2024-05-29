MATCH (parentComment:Comment { id: $commentId })<-[:IS_REPLY_TO]-(child:Comment)

// OPTIONAL MATCHES to get related details
OPTIONAL MATCH (child)<-[:AUTHORED_COMMENT]-(author:User)
OPTIONAL MATCH (author)-[:HAS_SERVER_ROLE]->(serverRole:ServerRole)
OPTIONAL MATCH (child)<-[:UPVOTED_COMMENT]-(upvoter:User)

// We also need to get the aggregate count of replies to the reply (grandchild comments).
// We do this by matching the grandchild comments and then aggregating them.
OPTIONAL MATCH (child)<-[:IS_REPLY_TO]-(grandchild:Comment)
WITH child, author, serverRole, upvoter, COLLECT(DISTINCT grandchild) AS GrandchildComments

WITH child, author, serverRole, upvoter, GrandchildComments, $modName AS modName

OPTIONAL MATCH (child)<-[:HAS_FEEDBACK_COMMENT]-(feedbackComment:Comment)<-[:AUTHORED_COMMENT]-(feedbackAuthor:ModerationProfile)

WITH child, author, serverRole, upvoter, GrandchildComments, feedbackComment, feedbackAuthor, modName,
    CASE WHEN modName IS NOT NULL AND feedbackAuthor.displayName = modName THEN feedbackComment
        ELSE NULL END AS potentialFeedbackComment

// Calculations for the sorting formulae
WITH child, author, serverRole, GrandchildComments, potentialFeedbackComment,
     COLLECT(DISTINCT upvoter) AS UpvotedByUsers,
     COLLECT(DISTINCT CASE WHEN potentialFeedbackComment IS NOT NULL THEN {id: potentialFeedbackComment.id} END) AS FeedbackComments,
     duration.between(child.createdAt, datetime()).months + 
     duration.between(child.createdAt, datetime()).days / 30.0 AS ageInMonths,
     CASE WHEN coalesce(child.weightedVotesCount, 0) < 0 THEN 0 ELSE coalesce(child.weightedVotesCount, 0) END AS weightedVotesCount

WITH child, author, serverRole, UpvotedByUsers, ageInMonths, weightedVotesCount,
     GrandchildComments, FeedbackComments,
     10000 * log10(weightedVotesCount + 1) / ((ageInMonths + 2) ^ 1.8) AS hotRank


WITH child, author, UpvotedByUsers, weightedVotesCount, hotRank, GrandchildComments, FeedbackComments,
     COLLECT(DISTINCT serverRole) AS serverRoles

WITH child, author, UpvotedByUsers, weightedVotesCount, hotRank, GrandchildComments, FeedbackComments,
     [role IN serverRoles | {showAdminTag: role.showAdminTag}] AS serverRoles


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
        displayName: author.displayName,
        profilePicURL: author.profilePicURL,
        discussionKarma: author.discussionKarma,
        commentKarma: author.commentKarma,
        createdAt: author.createdAt,
        ServerRoles: serverRoles
    },
    UpvotedByUsers: [user IN UpvotedByUsers | user{.*, createdAt: toString(user.createdAt)}],
    UpvotedByUsersAggregate: {
        count: SIZE(UpvotedByUsers)
    },
    ChildCommentsAggregate: {
        count: SIZE(GrandchildComments)
    },
    // Return empty array if no feedback comment
    FeedbackComments: [comment IN FeedbackComments WHERE comment IS NOT NULL | comment]
} AS ChildComments, weightedVotesCount, hotRank

ORDER BY 
    CASE WHEN $sortOption = "top" THEN weightedVotesCount END DESC,
    CASE WHEN $sortOption = "hot" THEN hotRank END DESC,
    child.createdAt DESC

SKIP toInteger($offset)
LIMIT toInteger($limit)
