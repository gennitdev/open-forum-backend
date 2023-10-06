MATCH (d:Discussion {id: $discussionId})<-[r:POSTED_IN_CHANNEL]-(dc:DiscussionChannel {discussionId: $discussionId, channelUniqueName: $channelUniqueName})
DELETE r