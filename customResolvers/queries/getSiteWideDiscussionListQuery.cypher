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
WITH dc, d, COLLECT(DISTINCT u.username) as userUsernames
OPTIONAL MATCH (dc)-[:CONTAINS_COMMENT]->(c:Comment)
WITH dc, d, userUsernames, COUNT(c) as commentCount
OPTIONAL MATCH (d)-[:HAS_TAG]->(tag:Tag)
WITH d, dc, userUsernames, commentCount, tag
WHERE SIZE($selectedTags) = 0 OR tag.text IN $selectedTags
OPTIONAL MATCH (d)<-[:POSTED_DISCUSSION]-(author:User)
WITH d, author, dc,
     COUNT(userUsernames) as score,
     COLLECT(DISTINCT {
       id: dc.id,
       createdAt: dc.createdAt,
       channelUniqueName: dc.channelUniqueName,
       discussionId: dc.discussionId,
       upvoteCount: dc.upvoteCount,
       UpvotedByUsers: userUsernames,
       Channel: { uniqueName: dc.channelUniqueName },
       Discussion: { id: dc.discussionId },
       CommentsAggregate: { count: commentCount }  // Include comment count
     }) as DiscussionChannels,
     COLLECT(DISTINCT tag.text) as Tags
RETURN d.id as id, d.title as title, d.body as body, d.createdAt as createdAt, d.updatedAt as updatedAt,
       {username: author.username} as Author,
       DiscussionChannels,
       Tags,
       score
ORDER BY score DESC