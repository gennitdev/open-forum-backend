// Calculate the aggregate discussion count first with tag handling
MATCH (dAgg:Discussion)
WHERE EXISTS((dAgg)<-[:POSTED_IN_CHANNEL]-(:DiscussionChannel))
AND (CASE WHEN $sortOption = "top" THEN datetime(dAgg.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis ELSE TRUE END)

// Filter by text
AND ($searchInput = "" OR dAgg.title CONTAINS $searchInput OR dAgg.body CONTAINS $searchInput)

// create the dc variable so that we can get the comments and 
// user upvoters for the dc
WITH dAgg
OPTIONAL MATCH (dAgg)<-[:POSTED_IN_CHANNEL]-(dcAgg:DiscussionChannel)
// Filter by channel
WHERE (SIZE($selectedChannels) = 0 OR dcAgg.channelUniqueName IN $selectedChannels)

OPTIONAL MATCH (dAgg)-[:HAS_TAG]->(tagAgg:Tag)
WITH dAgg, COLLECT(DISTINCT tagAgg.text) AS aggregateTagsText
// Filter by tag
WHERE SIZE($selectedTags) = 0 OR ANY(t IN aggregateTagsText WHERE t IN $selectedTags)
WITH COUNT(DISTINCT dAgg) AS aggregateDiscussionCount

////////////////////////////////////////////////////////////////

// Do the same filtering logic as above, but this time, instead of just getting
// the total count, we collect all the data we need for the result.

// Fetch the unique discussions based on the criteria
MATCH (d:Discussion)
WHERE EXISTS((d)<-[:POSTED_IN_CHANNEL]-(:DiscussionChannel))
AND (CASE WHEN $sortOption = "top" THEN datetime(d.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis ELSE TRUE END)

// Filter by text
AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)

// create the dc variable so that we can get the comments and
// user upvoters for the dc
WITH d, aggregateDiscussionCount
OPTIONAL MATCH (d)<-[:POSTED_IN_CHANNEL]-(dc:DiscussionChannel)
OPTIONAL MATCH (dc:DiscussionChannel {discussionId: d.id})-[:UPVOTED_DISCUSSION]->(upvoter:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)

// Filter by channel
WHERE (SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels)



// First, fetch upvoted users per discussion channel
WITH d, dc, aggregateDiscussionCount
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(upvoter:User)
WITH d, dc, COLLECT(DISTINCT upvoter) AS upvotedByUsers, aggregateDiscussionCount

// Next, fetch comments per discussion channel
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
WITH d, dc, upvotedByUsers, COUNT(DISTINCT c) AS commentsCount, aggregateDiscussionCount

// Compute score for each discussion channel
WITH d, dc, upvotedByUsers, commentsCount, aggregateDiscussionCount,
     SUM(COALESCE(dc.weightedVotesCount, 0)) AS score

// Now, group by discussion and collect the discussion channels with their aggregates
WITH d, aggregateDiscussionCount, score,
     COLLECT({
         id: dc.id,
         createdAt: dc.createdAt,
         channelUniqueName: dc.channelUniqueName,
         discussionId: dc.discussionId,
         UpvotedByUsers: [up in upvotedByUsers | { username: up.username }],
         CommentsAggregate: {
             count: commentsCount
         }
     }) AS discussionChannels

WITH d, discussionChannels, aggregateDiscussionCount, score

// Handle tags
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)

WITH d, aggregateDiscussionCount,
    COLLECT(DISTINCT tag.text) AS tagsText,
    discussionChannels,
    score

// Filter by tag
WHERE SIZE($selectedTags) = 0 OR ANY(t IN tagsText WHERE t IN $selectedTags)

OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)

// Calculate the discussion's age in months
WITH d, 
  aggregateDiscussionCount, 
  tagsText, 
  author, 
  discussionChannels, 
  score,
  duration.between(d.createdAt, datetime()).months + 
    duration.between(d.createdAt, datetime()).days / 30.0 AS ageInMonths

// Give a default value for the age in months if it's null
WITH d, 
  aggregateDiscussionCount, 
  tagsText, 
  author, 
  discussionChannels, 
  score,
  CASE WHEN ageInMonths IS NULL THEN 0 ELSE ageInMonths END AS ageInMonths

// Calculate the rank based on the age in months and the score
WITH d,
    aggregateDiscussionCount,
    tagsText,
    author, 
    discussionChannels,
    CASE WHEN score < 0 THEN 0 ELSE score END AS score, 
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