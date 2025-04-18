MATCH (u:User {username: $username})
WITH u, date($startDate) AS startDate, date($endDate) AS endDate

// Match comments within range
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(comment:Comment)
WHERE date(comment.createdAt) >= startDate AND date(comment.createdAt) <= endDate
WITH u, startDate, endDate, collect(comment) AS comments

// Match discussions within range
OPTIONAL MATCH (u)-[:POSTED_DISCUSSION]->(discussion:Discussion)
WHERE date(discussion.createdAt) >= startDate AND date(discussion.createdAt) <= endDate
WITH u, startDate, endDate, comments, collect(discussion) AS discussions

// Match events within range
OPTIONAL MATCH (u)-[:POSTED_BY]->(event:Event)
WHERE date(event.createdAt) >= startDate AND date(event.createdAt) <= endDate
WITH comments, discussions, collect(event) AS events

// Explicitly combine into one list after aggregation
WITH (comments + discussions + events) AS allActivities
UNWIND allActivities AS activity

// Group explicitly by activity date
WITH date(activity.createdAt) AS activityDate, collect(activity) AS activities
RETURN 
  toString(activityDate) AS date,
  size(activities) AS count,
  [{
    id: 'activity-' + toString(activityDate),
    type: 'activity',
    description: 'Activity on ' + toString(activityDate),
    Comments: [a IN activities WHERE a:Comment | {
      id: a.id,
      text: COALESCE(a.text, ""),
      createdAt: toString(a.createdAt)
    }],
    Discussions: [a IN activities WHERE a:Discussion | {
      id: a.id,
      title: COALESCE(a.title, ""),
      createdAt: toString(a.createdAt)
    }],
    Events: [a IN activities WHERE a:Event | {
      id: a.id,
      title: COALESCE(a.title, ""),
      createdAt: toString(a.createdAt)
    }]
  }] AS activities
ORDER BY activityDate ASC
