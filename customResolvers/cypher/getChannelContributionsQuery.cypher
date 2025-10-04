// Simple query to find contributors to a channel
MATCH (channel:Channel {uniqueName: $channelUniqueName})

// Find discussion authors in this channel
// DiscussionChannel points to both Discussion and Channel
MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)
MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
MATCH (u:User)-[:POSTED_DISCUSSION]->(d)
WHERE date(datetime(d.createdAt)) >= date($startDate)
  AND date(datetime(d.createdAt)) <= date($endDate)

WITH u, channel, d, dc
ORDER BY d.createdAt DESC

// Collect discussions per user
WITH u, channel,
  collect({
    id: d.id,
    title: d.title,
    createdAt: toString(d.createdAt),
    Author: {
      username: u.username,
      profilePicURL: u.profilePicURL
    },
    DiscussionChannels: [{
      id: dc.id,
      channelUniqueName: dc.channelUniqueName,
      discussionId: dc.discussionId
    }]
  }) AS discussions

// Group by date
UNWIND discussions AS disc
WITH u, channel,
  date(datetime(disc.createdAt)) AS activityDate,
  disc

WITH u, channel, activityDate,
  collect(disc) AS discussionsOnDate

// Build day data
WITH u, channel,
  collect({
    date: toString(activityDate),
    count: size(discussionsOnDate),
    activities: [{
      id: 'activity-' + toString(activityDate),
      type: 'activity',
      description: 'Activity on ' + toString(activityDate),
      Comments: [],
      Discussions: discussionsOnDate
    }]
  }) AS dayData

// Return results
RETURN
  u.username AS username,
  u.displayName AS displayName,
  u.profilePicURL AS profilePicURL,
  size([d IN dayData | d.count]) AS totalContributions,
  dayData
ORDER BY totalContributions DESC
LIMIT toInteger(COALESCE($limit, 10))
