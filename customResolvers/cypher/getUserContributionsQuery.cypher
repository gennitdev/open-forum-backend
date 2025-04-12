// More memory-efficient implementation
MATCH (u:User {username: $username})
WHERE u.username IS NOT NULL

// Get all types of activity by date range
WITH u, date($startDate) as startDate, date($endDate) as endDate

// Get all activity dates first
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(c:Comment)
WHERE date(c.createdAt) >= startDate AND date(c.createdAt) <= endDate
WITH u, startDate, endDate, collect(distinct date(c.createdAt)) as commentDates

OPTIONAL MATCH (u)-[:POSTED_DISCUSSION]->(d:Discussion)
WHERE date(d.createdAt) >= startDate AND date(d.createdAt) <= endDate
WITH u, startDate, endDate, commentDates, collect(distinct date(d.createdAt)) as discussionDates

OPTIONAL MATCH (u)-[:POSTED_BY]->(e:Event)
WHERE date(e.createdAt) >= startDate AND date(e.createdAt) <= endDate
WITH u, startDate, endDate, commentDates, discussionDates, collect(distinct date(e.createdAt)) as eventDates

// Combine all dates
WITH u, startDate, endDate, commentDates + discussionDates + eventDates AS allDates
UNWIND allDates AS dateKey
WITH u, startDate, endDate, dateKey
WHERE dateKey IS NOT NULL

// Now collect activities for each date, ensuring no null values
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(c:Comment)
WHERE date(c.createdAt) = dateKey AND c.id IS NOT NULL
// Collect only valid comments with all required fields
WITH u, dateKey, [c IN collect(c) WHERE c.id IS NOT NULL AND c.createdAt IS NOT NULL | {
  id: c.id, 
  text: CASE WHEN c.text IS NULL THEN "" ELSE c.text END, 
  createdAt: toString(c.createdAt)
}] AS comments

OPTIONAL MATCH (u)-[:POSTED_DISCUSSION]->(d:Discussion)
WHERE date(d.createdAt) = dateKey AND d.id IS NOT NULL
// Collect only valid discussions with all required fields
WITH u, dateKey, comments, [d IN collect(d) WHERE d.id IS NOT NULL AND d.title IS NOT NULL AND d.createdAt IS NOT NULL | {
  id: d.id, 
  title: d.title, 
  createdAt: toString(d.createdAt)
}] AS discussions

OPTIONAL MATCH (u)-[:POSTED_BY]->(e:Event)
WHERE date(e.createdAt) = dateKey AND e.id IS NOT NULL
// Collect only valid events with all required fields
WITH dateKey, comments, discussions, [e IN collect(e) WHERE e.id IS NOT NULL AND e.title IS NOT NULL AND e.createdAt IS NOT NULL | {
  id: e.id, 
  title: e.title, 
  createdAt: toString(e.createdAt)
}] AS events

// Calculate counts
WITH dateKey, 
     comments,
     discussions,
     events,
     size(comments) AS commentCount,
     size(discussions) AS discussionCount,
     size(events) AS eventCount,
     size(comments) + size(discussions) + size(events) AS totalCount

// Create enriched activities for the day
WITH dateKey, totalCount,
     CASE WHEN commentCount > 0 THEN [{
       id: 'comment-' + toString(dateKey) + '-' + toString(commentCount),
       type: 'comment',
       description: 'Posted ' + commentCount + ' comment(s)',
       Comments: comments,
       Discussions: [],
       Events: []
     }] ELSE [] END +
     CASE WHEN discussionCount > 0 THEN [{
       id: 'discussion-' + toString(dateKey) + '-' + toString(discussionCount),
       type: 'discussion',
       description: 'Created ' + discussionCount + ' discussion(s)',
       Comments: [],
       Discussions: discussions,
       Events: []
     }] ELSE [] END +
     CASE WHEN eventCount > 0 THEN [{
       id: 'event-' + toString(dateKey) + '-' + toString(eventCount),
       type: 'event',
       description: 'Created ' + eventCount + ' event(s)',
       Comments: [],
       Discussions: [],
       Events: events
     }] ELSE [] END AS activities
     
// Only return dates with activities
WHERE totalCount > 0

// Format results
RETURN toString(dateKey) AS date, 
       totalCount AS count,
       activities
ORDER BY dateKey ASC // Ensures chronological ordering by date at the database level