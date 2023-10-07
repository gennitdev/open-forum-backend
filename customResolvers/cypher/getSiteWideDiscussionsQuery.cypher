// Calculate the aggregate discussion count first with tag handling
MATCH (dcAgg:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(dAgg:Discussion)
WHERE (SIZE($selectedChannels) = 0 OR dcAgg.channelUniqueName IN $selectedChannels)
AND ($searchInput = "" OR dAgg.title CONTAINS $searchInput OR dAgg.body CONTAINS $searchInput)
AND (CASE WHEN $sortOption = "top" THEN datetime(dAgg.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis ELSE TRUE END)
OPTIONAL MATCH (dAgg)-[:HAS_TAG]->(tagAgg:Tag)
WITH dAgg, COLLECT(DISTINCT tagAgg.text) AS aggregateTagsText
WHERE SIZE($selectedTags) = 0 OR ANY(t IN aggregateTagsText WHERE t IN $selectedTags)
WITH COUNT(DISTINCT dAgg) AS aggregateDiscussionCount


// Fetch the unique discussions based on the criteria
MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(d:Discussion)
WHERE (SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels)
AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)
AND (CASE WHEN $sortOption = "top" THEN datetime(d.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis ELSE TRUE END)

// Handle tags
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)
WITH d, aggregateDiscussionCount, 
     COLLECT(DISTINCT tag.text) AS tagsText, 
     COLLECT(DISTINCT tag) AS tags
WHERE SIZE($selectedTags) = 0 OR ANY(t IN tagsText WHERE t IN $selectedTags)

OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (dc:DiscussionChannel {id: d.discussionChannelId})-[:UPVOTED_DISCUSSION]->(u:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)

// Group by discussions and aggregate
WITH DISTINCT d, 
    author, 
    tagsText, 
    COLLECT(DISTINCT u.username) AS upvoteUsernames, 
    COUNT(DISTINCT c) AS commentCount, 
    SUM(COALESCE(dc.weightedVotesCount, 0)) AS score,
    duration.between(d.createdAt, datetime()).months + 
    duration.between(d.createdAt, datetime()).days / 30.0 AS ageInMonths, 
    aggregateDiscussionCount

WITH d, 
    author, 
    tagsText, 
    upvoteUsernames, 
    commentCount, 
    CASE WHEN score < 0 THEN 0 ELSE score END AS score, 
    CASE WHEN ageInMonths IS NULL THEN 0 ELSE ageInMonths END AS ageInMonths, 
    aggregateDiscussionCount,
    CASE WHEN $sortOption = "hot" THEN 10000 * log10(score + 1) / ((ageInMonths + 2) ^ 1.8) ELSE NULL END AS rank

// Return the results
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
  UpvotedByUsers: upvoteUsernames,
  CommentsAggregate: { count: commentCount },
  Tags: [t IN tagsText | {text: t}],
  aggregateDiscussionCount: aggregateDiscussionCount
} AS discussion, aggregateDiscussionCount, score, rank 
ORDER BY 
    CASE WHEN $sortOption = "new" THEN discussion.createdAt END DESC,
    CASE WHEN $sortOption = "top" THEN score END DESC,
    CASE WHEN $sortOption = "hot" THEN rank END DESC,
    discussion.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
