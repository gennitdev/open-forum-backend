MATCH (channel:Channel {uniqueName: $channelUniqueName})
WITH channel, date($startDate) AS startDate, date($endDate) AS endDate

// Find all users who have contributed to this channel
MATCH (u:User)
WHERE (
  // Comments in discussions in this channel
  EXISTS((u)-[:AUTHORED_COMMENT]->(:Comment)<-[:CONTAINS_COMMENT]-(:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)) OR
  // Discussions in this channel
  EXISTS((u)-[:POSTED_DISCUSSION]->(:Discussion)<-[:POSTED_IN_CHANNEL]-(:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)) OR
  // Events in this channel
  EXISTS((u)-[:POSTED_BY]->(:Event)<-[:POSTED_IN_CHANNEL]-(:EventChannel)-[:POSTED_IN_CHANNEL]->(channel))
)

WITH channel, startDate, endDate, u

// Match comments in this channel
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(comment:Comment)<-[:CONTAINS_COMMENT]-(discussionChannel:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)
WHERE date(datetime(comment.createdAt)) >= startDate AND date(datetime(comment.createdAt)) <= endDate
OPTIONAL MATCH (comment)<-[:AUTHORED_COMMENT]-(commentAuthor:User)
OPTIONAL MATCH (discussionChannel)-[:POSTED_IN_CHANNEL]->(discussionChannelNode:Channel)
OPTIONAL MATCH (event:Event)-[:HAS_COMMENT]->(comment)

WITH channel, startDate, endDate, u, collect({
  id: comment.id,
  text: COALESCE(comment.text, ""),
  createdAt: toString(comment.createdAt),
  CommentAuthor: CASE WHEN commentAuthor IS NOT NULL THEN {
    username: commentAuthor.username,
    profilePicURL: COALESCE(commentAuthor.profilePicURL, null)
  } ELSE NULL END,
  Channel: {
    uniqueName: channel.uniqueName,
    displayName: channel.displayName,
    description: channel.description,
    channelIconURL: channel.channelIconURL
  },
  DiscussionChannel: CASE
    WHEN discussionChannel IS NOT NULL THEN {
      id: discussionChannel.id,
      discussionId: discussionChannel.discussionId,
      channelUniqueName: discussionChannelNode.uniqueName
    } ELSE NULL END,
  Event: CASE WHEN event IS NOT NULL THEN {
    id: event.id,
    title: COALESCE(event.title, ""),
    createdAt: toString(event.createdAt)
  } ELSE NULL END
}) AS comments

// Match discussions in this channel
OPTIONAL MATCH (u)-[:POSTED_DISCUSSION]->(discussion:Discussion)<-[:POSTED_IN_CHANNEL]-(dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)
WHERE date(datetime(discussion.createdAt)) >= startDate AND date(datetime(discussion.createdAt)) <= endDate
OPTIONAL MATCH (discussion)<-[:POSTED_DISCUSSION]-(discussionAuthor:User)

WITH channel, startDate, endDate, u, comments, collect({
  id: discussion.id,
  title: COALESCE(discussion.title, ""),
  createdAt: toString(discussion.createdAt),
  Author: CASE WHEN discussionAuthor IS NOT NULL THEN {
    username: discussionAuthor.username,
    profilePicURL: COALESCE(discussionAuthor.profilePicURL, null)
  } ELSE NULL END,
  DiscussionChannels: CASE WHEN dc IS NOT NULL THEN [{
    id: dc.id,
    channelUniqueName: channel.uniqueName,
    discussionId: dc.discussionId
  }] ELSE [] END
}) AS discussions

// Match events in this channel
OPTIONAL MATCH (u)-[:POSTED_BY]->(event:Event)<-[:POSTED_IN_CHANNEL]-(ec:EventChannel)-[:POSTED_IN_CHANNEL]->(channel)
WHERE date(datetime(event.createdAt)) >= startDate AND date(datetime(event.createdAt)) <= endDate
OPTIONAL MATCH (event)<-[:POSTED_BY]-(eventPoster:User)

WITH u, comments, discussions, collect({
  id: event.id,
  title: COALESCE(event.title, ""),
  createdAt: toString(event.createdAt),
  Poster: CASE WHEN eventPoster IS NOT NULL THEN {
    username: eventPoster.username,
    profilePicURL: COALESCE(eventPoster.profilePicURL, null)
  } ELSE NULL END,
  EventChannels: CASE WHEN ec IS NOT NULL THEN [{
    id: ec.id,
    channelUniqueName: ec.channelUniqueName,
    eventId: ec.eventId
  }] ELSE [] END
}) AS events

// Calculate total contributions and group by date
WITH u, (comments + discussions + events) AS allActivities
WITH u,
  u.username AS username,
  u.displayName AS displayName,
  u.profilePicURL AS profilePicURL,
  size(allActivities) AS totalContributions,
  allActivities

WHERE size(allActivities) > 0

// Group activities by date
UNWIND allActivities AS activity
WITH username, displayName, profilePicURL, totalContributions,
  date(datetime(activity.createdAt)) AS activityDate,
  collect(activity) AS activitiesOnDate

// Return user data with their contributions grouped by date
WITH username, displayName, profilePicURL, totalContributions,
  collect({
    date: toString(activityDate),
    count: size(activitiesOnDate),
    activities: [{
      id: 'activity-' + toString(activityDate),
      type: 'activity',
      description: 'Activity on ' + toString(activityDate),
      Comments: [a IN activitiesOnDate WHERE a.text IS NOT NULL | a],
      Discussions: [a IN activitiesOnDate WHERE a.title IS NOT NULL AND a.DiscussionChannels IS NOT NULL | a],
      Events: [a IN activitiesOnDate WHERE a.title IS NOT NULL AND a.EventChannels IS NOT NULL | a]
    }]
  }) AS dayData

WHERE totalContributions > 0

RETURN
  username,
  displayName,
  profilePicURL,
  totalContributions,
  dayData
ORDER BY totalContributions DESC
LIMIT toInteger(COALESCE($limit, 10))
