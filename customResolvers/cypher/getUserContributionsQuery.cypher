// Simple query that works when users don't have any contributions
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

// Get comments for this user
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(comment:Comment)
WHERE date(comment.createdAt) >= startDate AND date(comment.createdAt) <= endDate

// Group by date to get comment counts
WITH u, startDate, endDate, date(comment.createdAt) AS dateKey, count(comment) AS commentCount
WHERE dateKey IS NOT NULL

// For each date, get real comment data
MATCH (u:User {username: $username})-[:AUTHORED_COMMENT]->(c:Comment)
WHERE date(c.createdAt) = dateKey
OPTIONAL MATCH (c)-[:POSTED_IN]->(ch:Channel)
OPTIONAL MATCH (c)<-[:AUTHORED_COMMENT]-(ca:User)
WITH dateKey, commentCount, collect({
  id: c.id,
  text: COALESCE(c.text, ""),
  createdAt: toString(c.createdAt),
  Channel: CASE WHEN ch IS NOT NULL THEN {
    uniqueName: COALESCE(ch.uniqueName, "")
  } ELSE null END,
  CommentAuthor: CASE WHEN ca IS NOT NULL THEN {
    username: COALESCE(ca.username, "")
  } ELSE null END
}) as commentDetails

// Create activities array
WITH dateKey, commentCount AS totalCount,
     [{
       id: 'comment-' + toString(dateKey) + '-' + toString(commentCount),
       type: 'comment',
       description: 'Posted ' + commentCount + ' comment(s)',
       Comments: commentDetails,
       Discussions: [],
       Events: []
     }] AS activities
     
// Return the data
RETURN toString(dateKey) AS date, 
       totalCount AS count,
       activities
ORDER BY dateKey ASC