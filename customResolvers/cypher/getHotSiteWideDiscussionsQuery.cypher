WITH COALESCE(null, 0) AS aggregateDiscussionCount

// Calculate the aggregate discussion count first
MATCH (dcAgg:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(dAgg:Discussion)
WHERE (SIZE($selectedChannels) = 0 OR dcAgg.channelUniqueName IN $selectedChannels)
AND ($searchInput = "" OR dAgg.title CONTAINS $searchInput OR dAgg.body CONTAINS $searchInput)
WITH COUNT(DISTINCT dAgg) AS aggregateDiscussionCount

// Fetch the unique discussions based on the criteria
MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(d:Discussion)
WHERE (SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels)
AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)
WITH d, aggregateDiscussionCount

// First, match the tags and gather them for each discussion
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)
WITH d, aggregateDiscussionCount, 
     [x IN COLLECT(tag.text) WHERE x IS NOT NULL] AS tagsText, 
     [y IN COLLECT(tag) WHERE y.text IS NOT NULL] AS tags

OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
OPTIONAL MATCH (d)<-[:POSTED_IN_CHANNEL]-(dc:DiscussionChannel)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(u:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)

// Group by discussions and aggregate
WITH d, author, tags, tagsText, aggregateDiscussionCount,
     COLLECT(DISTINCT u.username) AS upvoteUsernames, 
     COUNT(DISTINCT c) AS commentCount, 
     SUM(COALESCE(dc.weightedVotesCount, 0)) AS score,
     // Using MAX to handle ageInMonths for the grouping 
     duration.between(dc.createdAt, datetime()).months + 
     duration.between(dc.createdAt, datetime()).days / 30.0 AS ageInMonths

WITH d, author, tags, tagsText, upvoteUsernames, commentCount, aggregateDiscussionCount,
      CASE WHEN score < 0 THEN 0 ELSE score END AS score,
      CASE WHEN ageInMonths IS NULL THEN 0 ELSE ageInMonths END AS ageInMonths

WITH d, author, tags, tagsText, upvoteUsernames, commentCount, score, aggregateDiscussionCount,
    // Use ageInMonths to calculate the rank.
    10000 * log10(score + 1) / ((ageInMonths + 2) ^ 1.8) AS rank

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
} AS discussion, aggregateDiscussionCount, rank 
ORDER BY rank DESC, discussion.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
