// Get discussions. Take selected channels and other filters as input.
// We are sorting by the number of upvotes, and we count that by doing this:
// 1. We get the discussions that are posted in the selected channels,
//    and that also satisfy the other filters.
// 2. We get the DiscussionChannels that represent the connections between
//    the discussions and the channels. These nodes contain the votes that
//    the discussions have received.
// 3. Technically, we could use upvoteCount to tally the votes, but in my opinion,
//    it is probably better to count the number of UPVOTED_DISCUSSION relationships
//    and deduplicate them by user. This is to avoid creating a strange incentive
//    for users to spam a discussion to as many channels as possible.
// 4. We sort the discussions by the number of upvotes, deduplicated by user.
MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(d:Discussion)
WHERE (SIZE($selectedChannels) = 0 OR dc.channelUniqueName IN $selectedChannels)
  AND ($searchInput = "" OR d.title CONTAINS $searchInput OR d.body CONTAINS $searchInput)
OPTIONAL MATCH (dc)-[:UPVOTED_DISCUSSION]->(u:User)
WITH d, dc, COLLECT(DISTINCT u.username) as upvoteUsernames
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
WITH d, dc, upvoteUsernames, COUNT(c) as commentCount
WITH d, {
  id: dc.id,
  createdAt: dc.createdAt,
  channelUniqueName: dc.channelUniqueName,
  discussionId: dc.discussionId,
  upvoteCount: SIZE(upvoteUsernames),
  CommentsAggregate: { count: commentCount },
  UpvotedByUsers: [] // Placeholder for now
} as DiscussionChannel
WITH d, COLLECT(DiscussionChannel) as DiscussionChannels
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)
WITH d, DiscussionChannels, tag
WHERE SIZE($selectedTags) = 0 OR tag.text IN $selectedTags
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
WITH d, author, DiscussionChannels,
     COLLECT(DISTINCT tag.text) as Tags
WITH d, author, Tags,
     REDUCE(score = 0, dc IN DiscussionChannels | score + dc.upvoteCount) as score,
     DiscussionChannels
WITH collect({d: d, author: author, DiscussionChannels: DiscussionChannels, Tags: Tags, score: score}) as discussionsData, count(d) as aggregateDiscussionCount
UNWIND discussionsData as discussionData
RETURN discussionData.d.id as id, discussionData.d.title as title, discussionData.d.body as body, discussionData.d.createdAt as createdAt, discussionData.d.updatedAt as updatedAt,
       {username: discussionData.author.username} as Author,
       discussionData.DiscussionChannels as DiscussionChannels,
       discussionData.Tags as Tags,
       discussionData.score as score,
       aggregateDiscussionCount
ORDER BY score DESC

