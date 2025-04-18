// Simple query that works and includes comments in the result
MATCH (u:User {username: $username})
WHERE u.username IS NOT NULL

// Define date range
WITH u, date($startDate) as startDate, date($endDate) as endDate

// First check if the user has any activity at all
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(comment:Comment)
WHERE date(comment.createdAt) >= startDate AND date(comment.createdAt) <= endDate

OPTIONAL MATCH (u)-[:POSTED_DISCUSSION]->(discussion:Discussion)
WHERE date(discussion.createdAt) >= startDate AND date(discussion.createdAt) <= endDate

OPTIONAL MATCH (u)-[:POSTED_BY]->(event:Event)
WHERE date(event.createdAt) >= startDate AND date(event.createdAt) <= endDate

WITH u, startDate, endDate, count(comment) + count(discussion) + count(event) as totalActivityCount

// If user has no activity, return a dummy day with zero count
WITH u, startDate, endDate, totalActivityCount,
     CASE WHEN totalActivityCount = 0 THEN [date()] ELSE [] END as emptyDates

UNWIND 
  CASE 
    WHEN size(emptyDates) > 0 THEN emptyDates 
    ELSE [null]
  END as emptyDate
  
WITH u, startDate, endDate, totalActivityCount, emptyDate
WHERE emptyDate IS NOT NULL AND totalActivityCount = 0

// Return empty result for users with no activity
RETURN toString(emptyDate) as date,
       0 as count,
       [] as activities

// If there is activity, get it by date
UNION

// Regular query for users with activity
MATCH (u:User {username: $username})
WHERE u.username IS NOT NULL

// Define date range
WITH u, date($startDate) as startDate, date($endDate) as endDate

// COMMENTS - get comments for this user
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(comment:Comment)
WHERE date(comment.createdAt) >= startDate AND date(comment.createdAt) <= endDate

// Group by date to get comment counts
WITH u, startDate, endDate, date(comment.createdAt) AS dateKey, count(comment) AS commentCount
WHERE dateKey IS NOT NULL

// For each date, get real comment data
MATCH (u:User {username: $username})-[:AUTHORED_COMMENT]->(c:Comment)
WHERE date(c.createdAt) = dateKey

// Get both direct Channel relationships and Channel relationships through DiscussionChannel
OPTIONAL MATCH (c)-[:POSTED_IN]->(chDirect:Channel)
OPTIONAL MATCH (c)-[:CONTAINS_COMMENT]-(dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(chDiscussion:Channel)
OPTIONAL MATCH (c)<-[:AUTHORED_COMMENT]-(ca:User)

WITH dateKey, commentCount, c, chDirect, chDiscussion, ca
// Determine which Channel to use - prefer direct relationship if available
WITH dateKey, commentCount, c, ca, 
     CASE 
       WHEN chDirect IS NOT NULL THEN chDirect
       WHEN chDiscussion IS NOT NULL THEN chDiscussion
       ELSE null
     END as ch

WITH dateKey, commentCount, collect({
  id: c.id,
  text: COALESCE(c.text, ""),
  createdAt: toString(c.createdAt),
  Channel: CASE WHEN ch IS NOT NULL THEN {
    uniqueName: COALESCE(ch.uniqueName, ""),
    displayName: COALESCE(ch.displayName, ""),
    description: COALESCE(ch.description, ""),
    channelIconURL: COALESCE(ch.channelIconURL, "")
  } ELSE null END,
  CommentAuthor: CASE WHEN ca IS NOT NULL THEN {
    username: COALESCE(ca.username, "")
  } ELSE null END
}) as commentDetails

// DISCUSSIONS - get discussions for this user on the same day
OPTIONAL MATCH (u:User {username: $username})-[:POSTED_DISCUSSION]->(d:Discussion)
WHERE date(d.createdAt) = dateKey
WITH dateKey, commentCount, commentDetails, collect(d) as discussions

UNWIND CASE WHEN size(discussions) > 0 THEN discussions ELSE [null] END as d
WITH dateKey, commentCount, commentDetails, d
WHERE d IS NOT NULL

// Collect channels for this discussion
OPTIONAL MATCH (d)<-[:POSTED_IN_CHANNEL]-(dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(ch:Channel)
WITH dateKey, commentCount, commentDetails, d, 
     collect({
       id: CASE WHEN dc IS NOT NULL THEN dc.id ELSE null END,
       discussionId: d.id,
       channelUniqueName: CASE WHEN ch IS NOT NULL THEN ch.uniqueName ELSE null END
     }) as rawChannels

// Filter out any null entries
WITH dateKey, commentCount, commentDetails, d, 
     [x IN rawChannels WHERE x.id IS NOT NULL AND x.channelUniqueName IS NOT NULL] as discussionChannels

WITH dateKey, commentCount, commentDetails, collect({
  id: d.id,
  title: COALESCE(d.title, ""),
  createdAt: toString(d.createdAt),
  DiscussionChannels: discussionChannels
}) as discussionDetails

// EVENTS - get events for this user on the same day
OPTIONAL MATCH (u:User {username: $username})-[:POSTED_BY]->(e:Event)
WHERE date(e.createdAt) = dateKey
WITH dateKey, commentCount, commentDetails, discussionDetails, collect(e) as events

UNWIND CASE WHEN size(events) > 0 THEN events ELSE [null] END as e
WITH dateKey, commentCount, commentDetails, discussionDetails, e
WHERE e IS NOT NULL

// Collect channels for this event
OPTIONAL MATCH (e)<-[:POSTED_IN_CHANNEL]-(ec:EventChannel)-[:POSTED_IN_CHANNEL]->(ch:Channel)
WITH dateKey, commentCount, commentDetails, discussionDetails, e,
     collect({
       id: CASE WHEN ec IS NOT NULL THEN ec.id ELSE null END,
       eventId: e.id,
       channelUniqueName: CASE WHEN ch IS NOT NULL THEN ch.uniqueName ELSE null END
     }) as rawChannels

// Filter out any null entries
WITH dateKey, commentCount, commentDetails, discussionDetails, e,
     [x IN rawChannels WHERE x.id IS NOT NULL AND x.channelUniqueName IS NOT NULL] as eventChannels

WITH dateKey, commentCount, commentDetails, discussionDetails, collect({
  id: e.id,
  title: COALESCE(e.title, ""),
  createdAt: toString(e.createdAt),
  EventChannels: eventChannels
}) as eventDetails

// Count discussions and events for total count
WITH dateKey, 
     commentCount, 
     size(discussionDetails) as discussionCount, 
     size(eventDetails) as eventCount, 
     commentDetails, 
     discussionDetails, 
     eventDetails

// Create activities array with all activity types
WITH dateKey, 
     (commentCount + discussionCount + eventCount) AS totalCount,
     [{
       id: 'activity-' + toString(dateKey),
       type: 'activity',
       description: 'Activity on ' + toString(dateKey),
       Comments: commentDetails,
       Discussions: discussionDetails,
       Events: eventDetails
     }] AS activities
     
// Return the data
RETURN toString(dateKey) AS date, 
       totalCount AS count,
       activities
ORDER BY dateKey ASC