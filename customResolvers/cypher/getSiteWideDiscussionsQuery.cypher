MATCH (d:Discussion)
WHERE EXISTS((d)<-[:POSTED_IN_CHANNEL]-(:DiscussionChannel))
AND (CASE WHEN $sortOption = "top" THEN datetime(d.createdAt).epochMillis > datetime($startOfTimeFrame).epochMillis ELSE TRUE END)
AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)

// Collect all discussion channels associated with a discussion
WITH d
MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(d)
WHERE SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels
WITH d, COLLECT(dc) AS discussionChannels

// Unwind the discussion channels to work with them individually for fetching related data
UNWIND discussionChannels AS dc
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(upvoter:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
WITH d, dc, COLLECT(DISTINCT upvoter) AS upvotedByUsers, COUNT(DISTINCT c) AS commentsCount
WITH d, COLLECT({dc: dc, upvotedByUsers: upvotedByUsers, commentsCount: commentsCount}) AS channelData

// Now, you can proceed with calculating the score and other aggregations at the discussion level
WITH d, channelData, 
     REDUCE(s = 0, channel IN channelData | s + CASE WHEN coalesce(channel.dc.weightedVotesCount, 0) < 0 THEN 0 ELSE coalesce(channel.dc.weightedVotesCount, 0) END) AS score
WITH d, score,
     [channel IN channelData |
      {
        id: channel.dc.id,
        createdAt: channel.dc.createdAt,
        channelUniqueName: channel.dc.channelUniqueName,
        discussionId: channel.dc.discussionId,
        UpvotedByUsers: [up in channel.upvotedByUsers | { username: up.username }],
        CommentsAggregate: {
            count: channel.commentsCount
        }
      }] AS discussionChannels

WITH d, discussionChannels, score

// Handle tags
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)

WITH d,
    COLLECT(DISTINCT tag.text) AS tagsText,
    discussionChannels,
    score

// Filter by tag
WHERE SIZE($selectedTags) = 0 OR ANY(t IN tagsText WHERE t IN $selectedTags)

OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)


// Calculate the discussion's age in months
WITH d, 
  tagsText, 
  author, 
  discussionChannels, 
  score,
  duration.between(d.createdAt, datetime()).months + 
    duration.between(d.createdAt, datetime()).days / 30.0 AS ageInMonths

// Give a default value for the age in months if it's null
WITH d, 
  tagsText, 
  author, 
  discussionChannels, 
  score,
  CASE WHEN ageInMonths IS NULL THEN 0 ELSE ageInMonths END AS ageInMonths

// Calculate the rank based on the age in months and the score
WITH d,
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
                    displayName: author.displayName,
                    createdAt: author.createdAt,
                    discussionKarma: author.commentKarma,
                    commentKarma: author.discussionKarma
                }
              END,
    DiscussionChannels: discussionChannels,
    Tags: [t IN tagsText | {text: t}]
} AS discussion, score, rank

ORDER BY 
    CASE WHEN $sortOption = "new" THEN discussion.createdAt END DESC,
    CASE WHEN $sortOption = "top" THEN score END DESC,
    CASE WHEN $sortOption = "hot" THEN rank END DESC,
    discussion.createdAt DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)