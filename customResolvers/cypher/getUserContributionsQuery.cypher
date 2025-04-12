// More memory-efficient implementation
MATCH (u:User {username: $username})
WHERE u.username IS NOT NULL

// First, get comment activity by date (most common activity)
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(c:Comment)
WHERE date(c.createdAt) >= date($startDate) AND date(c.createdAt) <= date($endDate)
WITH date(c.createdAt) AS dateKey, count(c) AS commentCount, u
WHERE dateKey IS NOT NULL

// Then get discussion counts for the same dates
OPTIONAL MATCH (u)-[:POSTED_DISCUSSION]->(d:Discussion)
WHERE date(d.createdAt) = dateKey
WITH dateKey, commentCount, count(d) AS discussionCount, u

// Finally event counts
OPTIONAL MATCH (u)-[:POSTED_BY]->(e:Event)
WHERE date(e.createdAt) = dateKey
WITH dateKey, commentCount, discussionCount, count(e) AS eventCount

// Calculate total count
WITH dateKey, 
     commentCount, 
     discussionCount, 
     eventCount,
     commentCount + discussionCount + eventCount AS totalCount

// Create sample activities for the day (limit to a few examples)
WITH dateKey, totalCount,
     CASE WHEN commentCount > 0 THEN [{
       id: 'comment-' + toString(dateKey) + '-' + toString(commentCount),
       type: 'comment',
       description: 'Posted ' + commentCount + ' comment(s)',
       timestamp: toString(dateKey) + 'T12:00:00Z'
     }] ELSE [] END +
     CASE WHEN discussionCount > 0 THEN [{
       id: 'discussion-' + toString(dateKey) + '-' + toString(discussionCount),
       type: 'discussion',
       description: 'Created ' + discussionCount + ' discussion(s)',
       timestamp: toString(dateKey) + 'T12:00:00Z'
     }] ELSE [] END +
     CASE WHEN eventCount > 0 THEN [{
       id: 'event-' + toString(dateKey) + '-' + toString(eventCount),
       type: 'event',
       description: 'Created ' + eventCount + ' event(s)',
       timestamp: toString(dateKey) + 'T12:00:00Z'
     }] ELSE [] END AS activities

// Format results
RETURN toString(dateKey) AS date, 
       totalCount AS count,
       activities
ORDER BY dateKey ASC