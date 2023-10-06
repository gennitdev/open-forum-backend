MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(d:Discussion)
WHERE (SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels)
AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)

OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(u:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)

// Pattern comprehension to get the tags
WITH d, dc, u, c, author, [ (d)-[:HAS_TAG]->(tag:Tag) | tag.text ] AS tagsText
WHERE SIZE($selectedTags) = 0 OR ANY(tag IN tagsText WHERE tag IN $selectedTags)

WITH d, dc, u, tagsText, author, COLLECT( DISTINCT u.username) AS upvoteUsernames, c
WITH d, dc, u, tagsText, author, upvoteUsernames, COUNT(c) AS commentCount
WITH d, dc, u, tagsText, author, upvoteUsernames, commentCount, {
  id: dc.id,
  createdAt: dc.createdAt,
  channelUniqueName: dc.channelUniqueName,
  discussionId: dc.discussionId,
  CommentsAggregate: { count: commentCount },
  UpvotedByUsers: [],
  weightedVotesCount: dc.weightedVotesCount
  } AS DiscussionChannel

WITH d, dc, u, author, upvoteUsernames, commentCount,
  COLLECT(DiscussionChannel) AS DiscussionChannels,
  COLLECT( DISTINCT tagsText) AS Tags

// Each dc has a weightedVotesCount field. Get the sum of all the weightedVotesCount fields.
// This is the total weighted votes count for the discussion.
WITH d, dc, u, author, upvoteUsernames, commentCount, DiscussionChannels, Tags,
    REDUCE(weightedVotesCount = 0, dc IN DiscussionChannels | weightedVotesCount + COALESCE(dc.weightedVotesCount, 0)) AS score

WITH collect({ 
  d: d, 
  author: author, 
  score: score,
  DiscussionChannels: DiscussionChannels, 
  Tags: Tags
}) AS discussionsData, count(d) AS aggregateDiscussionCount, score

UNWIND discussionsData AS discussionData

RETURN {
  id: discussionData.d.id,
  title: discussionData.d.title,
  body: discussionData.d.body,
  createdAt: discussionData.d.createdAt,
  updatedAt: discussionData.d.updatedAt,
  Author: CASE
            WHEN discussionData.author IS NULL THEN null
            ELSE {
                username: discussionData.author.username,
                createdAt: discussionData.author.createdAt,
                discussionKarma: discussionData.author.commentKarma,
                commentKarma: discussionData.author.discussionKarma
            }
          END,
  DiscussionChannels: discussionData.DiscussionChannels,
  Tags: discussionData.Tags
} AS discussion, aggregateDiscussionCount, score

// We sort the discussions by the sum of the weightedVotesCount of all the related DiscussionChannels.
ORDER BY score DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
