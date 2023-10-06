WITH COALESCE(null, 0) AS aggregateDiscussionCount

// Calculate the aggregate discussion count first
MATCH (dcAgg:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(dAgg:Discussion)
WHERE (SIZE($selectedChannels) = 0 OR dcAgg.channelUniqueName IN $selectedChannels)
// Use the variable $startOfTimeFrame to filter results by time frame
// If $startOfTimeFrame is not provided, do not filter by time
AND datetime(dAgg.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis
AND ($searchInput = "" OR dAgg.title CONTAINS $searchInput OR dAgg.body CONTAINS $searchInput)
WITH COUNT(DISTINCT dAgg) AS aggregateDiscussionCount

// Fetch the unique discussions based on the criteria
MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(d:Discussion)
WHERE (SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels)
AND datetime(d.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis
AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)

// Aggregate related data to the discussion
WITH d, aggregateDiscussionCount
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)
OPTIONAL MATCH (d)<-[:POSTED_IN_CHANNEL]-(dc:DiscussionChannel)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(u:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)

// Filtering using selected tags
WHERE SIZE($selectedTags) = 0 OR tag.text IN $selectedTags

// Group by discussions and aggregate
WITH d, 
    author, 
    COLLECT(DISTINCT tag.text) AS tagsText, 
    COLLECT(DISTINCT u.username) AS upvoteUsernames, 
    COUNT(DISTINCT c) AS commentCount, 
    SUM(COALESCE(dc.weightedVotesCount, 0)) AS score, 
    aggregateDiscussionCount

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
  Tags: tagsText,
  aggregateDiscussionCount: aggregateDiscussionCount
} AS discussion, aggregateDiscussionCount, score 
ORDER BY score DESC, discussion.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
