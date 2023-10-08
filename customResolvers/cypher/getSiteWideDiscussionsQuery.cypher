// Calculate the aggregate discussion count first with tag handling
MATCH (dAgg:Discussion)
WHERE EXISTS((dAgg)<-[:POSTED_IN_CHANNEL]-(:DiscussionChannel))

// create the dc variable so that we can get the comments and 
// user upvoters for the dc
WITH dAgg
OPTIONAL MATCH (dAgg)<-[:POSTED_IN_CHANNEL]-(dcAgg:DiscussionChannel)

WHERE (SIZE($selectedChannels) = 0 OR dcAgg.channelUniqueName IN $selectedChannels)
AND ($searchInput = "" OR dAgg.title CONTAINS $searchInput OR dAgg.body CONTAINS $searchInput)
AND (CASE WHEN $sortOption = "top" THEN datetime(dAgg.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis ELSE TRUE END)
OPTIONAL MATCH (dAgg)-[:HAS_TAG]->(tagAgg:Tag)
WITH dAgg, COLLECT(DISTINCT tagAgg.text) AS aggregateTagsText
WHERE SIZE($selectedTags) = 0 OR ANY(t IN aggregateTagsText WHERE t IN $selectedTags)
WITH COUNT(DISTINCT dAgg) AS aggregateDiscussionCount

// Fetch the unique discussions based on the criteria
MATCH (d:Discussion)
WHERE EXISTS((d)<-[:POSTED_IN_CHANNEL]-(:DiscussionChannel))

// create the dc variable so that we can get the comments and
// user upvoters for the dc
WITH d, aggregateDiscussionCount
OPTIONAL MATCH (d)<-[:POSTED_IN_CHANNEL]-(dc:DiscussionChannel)

WHERE (SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels)
AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)
AND (CASE WHEN $sortOption = "top" THEN datetime(d.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis ELSE TRUE END)

// Handle tags
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)
WITH d, dc, aggregateDiscussionCount, 
     COLLECT(DISTINCT tag.text) AS tagsText, 
     COLLECT(DISTINCT tag) AS tags,
     COLLECT(DISTINCT dc) AS discussionChannels
WHERE SIZE($selectedTags) = 0 OR ANY(t IN tagsText WHERE t IN $selectedTags)

// Handle author, upvotes, comments, score, age
WITH d, dc, aggregateDiscussionCount, tagsText, tags

OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (dc:DiscussionChannel {discussionId: d.id})-[:UPVOTED_DISCUSSION]->(u:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(u:User)

WITH DISTINCT d as d, dc, aggregateDiscussionCount, tagsText, tags, author, u, c,
    COLLECT(DISTINCT dc) AS discussionChannels,
    COLLECT(DISTINCT u) AS upvotingUsers,
    COLLECT(DISTINCT c) AS channelComments

WITH d, dc, aggregateDiscussionCount, tagsText, tags, author, 
     upvotingUsers,
     COUNT(DISTINCT channelComments) AS commentCount,
     discussionChannels

// Group by discussions and aggregate
WITH d, dc,
    author, 
    tagsText, 
    SUM(COALESCE(dc.weightedVotesCount, 0)) AS score,
    duration.between(d.createdAt, datetime()).months + 
    duration.between(d.createdAt, datetime()).days / 30.0 AS ageInMonths,
    aggregateDiscussionCount,
    [discussionChannel in discussionChannels | {
        id: discussionChannel.id,
        createdAt: discussionChannel.createdAt,
        channelUniqueName: discussionChannel.channelUniqueName,
        discussionId: discussionChannel.discussionId,
        weightedVotesCount: discussionChannel.weightedVotesCount,
        UpvotedByUsers: [u IN upvotingUsers | {username: u.username}],
        CommentsAggregate: {
            count: commentCount
        }
    }] AS discussionChannels

WITH d,
    dc,
    author, 
    tagsText,
    discussionChannels,
    CASE WHEN score < 0 THEN 0 ELSE score END AS score, 
    CASE WHEN ageInMonths IS NULL THEN 0 ELSE ageInMonths END AS ageInMonths, 
    aggregateDiscussionCount,
    CASE WHEN $sortOption = "hot" THEN 10000 * log10(score + 1) / ((ageInMonths + 2) ^ 1.8) ELSE NULL END AS rank

RETURN
{
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
                    discussionKarma: author.commentKarma,
                    commentKarma: author.discussionKarma
                }
              END,
    aggregateDiscussionCount: aggregateDiscussionCount,
    DiscussionChannels: discussionChannels,
    Tags: [t IN tagsText | {text: t}]
} AS discussion, aggregateDiscussionCount, score, rank

ORDER BY 
    CASE WHEN $sortOption = "new" THEN discussion.createdAt END DESC,
    CASE WHEN $sortOption = "top" THEN score END DESC,
    CASE WHEN $sortOption = "hot" THEN rank END DESC,
    discussion.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)