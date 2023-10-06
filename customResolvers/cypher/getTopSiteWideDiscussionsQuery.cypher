// Get discussions. Take selected channels and other filters as input.
MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(d:Discussion)

WHERE (SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels)
 AND (SIZE($selectedTags) = 0 OR tag.text IN $selectedTags)
 AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)

OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(u:User)
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)

WITH d, dc, u, tag, author, COLLECT( DISTINCT u.username) AS upvoteUsernames
WITH d, dc, u, tag, author, upvoteUsernames, COUNT(c) AS commentCount
WITH d, dc, u, tag, author, upvoteUsernames, commentCount, {
  id: dc.id,
  createdAt: dc.createdAt,
  channelUniqueName: dc.channelUniqueName,
  discussionId: dc.discussionId,
  CommentsAggregate: { count: commentCount },
  UpvotedByUsers: [] // Placeholder for now
  } AS DiscussionChannel
  
WITH d, cd, u, author, upvoteUsernames, commentCount, 
  COLLECT(DiscussionChannel) AS DiscussionChannels,
  COLLECT( DISTINCT tag.text) AS Tags
  // Each dc has a weightedVotesCount field. Get the sum of all the weightedVotesCount fields.
    // This is the total weighted votes count for the discussion.
WITH d, u, author, upvoteUsernames, commentCount, DiscussionChannels, Tags,
    REDUCE(weightedVotesCount = 0, dc IN DiscussionChannels | weightedVotesCount + dc.weightedVotesCount) AS score

WITH collect({ 
  d: d, 
  author: author, 
  DiscussionChannels: DiscussionChannels, 
  Tags: Tags, 
  score: score 
}) AS discussionsData, count(d) AS aggregateDiscussionCount

UNWIND discussionsData AS discussionData

RETURN {
  id: discussionData.d.id,
  title: discussionData.d.title,
//   body: discussionData.d.body,
//   createdAt: discussionData.d.createdAt,
//   updatedAt: discussionData.d.updatedAt,
//   Author: {
//     username: discussionData.author.username,
//     createdAt: discussionData.author.createdAt,
//     commentKarma: discussionData.author.commentKarma,
//     discussionKarma: discussionData.author.discussionKarma
//   },
//   DiscussionChannels: discussionData.DiscussionChannels,
//   Tags: discussionData.Tags,
//   score: discussionData.score
} AS discussion//, aggregateDiscussionCount

// Sort the discussions by the sum of the weighted votes count of all the discussion channels.
ORDER BY score DESC
SKIP toInteger($offset)
LIMIT toInteger($limit)
