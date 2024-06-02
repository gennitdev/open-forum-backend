MATCH (e:Event { id: $eventId })-[:HAS_COMMENT]->(c:Comment)
WHERE c.isRootComment = true

OPTIONAL MATCH (c)<-[:AUTHORED_COMMENT]-(author:User)
OPTIONAL MATCH (author)-[:HAS_SERVER_ROLE]->(serverRole:ServerRole)
OPTIONAL MATCH (author)-[:HAS_CHANNEL_ROLE]->(channelRole:ChannelRole)
OPTIONAL MATCH (c)-[:IS_REPLY_TO]->(parent:Comment)
OPTIONAL MATCH (c)<-[:IS_REPLY_TO]-(child:Comment)
OPTIONAL MATCH (c)<-[:UPVOTED_COMMENT]-(upvoter:User)

WITH c, author, parent, serverRole, channelRole,
     COLLECT(DISTINCT upvoter{.*, createdAt: toString(upvoter.createdAt)}) AS UpvotedByUsers, 
     COLLECT(DISTINCT parent.id) AS parentIds,
     COLLECT(DISTINCT CASE WHEN child IS NOT NULL THEN {id: child.id, text: child.text} ELSE null END) AS NonFilteredChildComments,
     // Compute the age in months from the createdAt timestamp.
     duration.between(c.createdAt, datetime()).months + 
     duration.between(c.createdAt, datetime()).days / 30.0 AS ageInMonths,
     CASE WHEN coalesce(c.weightedVotesCount, 0) < 0 THEN 0 ELSE coalesce(c.weightedVotesCount, 0) END AS weightedVotesCount

WITH c, author, parent, UpvotedByUsers, parentIds, weightedVotesCount, serverRole, channelRole,
    [comment IN NonFilteredChildComments WHERE comment IS NOT NULL] AS ChildComments, 
    CASE WHEN ageInMonths IS NULL THEN 0 ELSE ageInMonths END AS ageInMonths

WITH c, author, parent, UpvotedByUsers, parentIds, ChildComments, weightedVotesCount, serverRole, channelRole,
    10000 * log10(weightedVotesCount + 1) / ((ageInMonths + 2) ^ 1.8) AS hotRank

WITH c, author, parent, UpvotedByUsers, parentIds, ChildComments, weightedVotesCount, hotRank,
    serverRole, COLLECT(DISTINCT channelRole) AS channelRoles

WITH c, author, parent, UpvotedByUsers, parentIds, ChildComments, weightedVotesCount, hotRank,
    channelRoles, COLLECT(DISTINCT serverRole) AS serverRoles

WITH c, author, parent, UpvotedByUsers, parentIds, ChildComments, weightedVotesCount, hotRank,
    [role in serverRoles | {showAdminTag: role.showAdminTag}] AS serverRoles, channelRoles 

WITH c, author, parent, UpvotedByUsers, parentIds, ChildComments, weightedVotesCount, hotRank,
    serverRoles, [role in channelRoles | {showModTag: role.showModTag}] AS channelRoles

RETURN {
    id: c.id,
    text: c.text,
    emoji: c.emoji,
    weightedVotesCount: c.weightedVotesCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    CommentAuthor: {
        username: author.username,
        displayName: author.displayName,
        profilePicURL: author.profilePicURL,
        discussionKarma: author.discussionKarma,
        commentKarma: author.commentKarma,
        createdAt: author.createdAt,
        ServerRoles: serverRoles,
        ChannelRoles: channelRoles
    },
    ParentComment: CASE WHEN SIZE(parentIds) > 0 THEN {id: parentIds[0]} ELSE null END,
    UpvotedByUsers: UpvotedByUsers,
    UpvotedByUsersAggregate: {
        count: SIZE(UpvotedByUsers)
    },
    ChildComments: CASE WHEN SIZE(ChildComments) > 0 THEN ChildComments ELSE [] END,
    ChildCommentsAggregate: {
        count: SIZE(ChildComments)
    }
} AS comment, weightedVotesCount, hotRank

ORDER BY 
    CASE WHEN $sortOption = "top" THEN weightedVotesCount END DESC,
    CASE WHEN $sortOption = "hot" THEN hotRank END DESC,
    c.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
