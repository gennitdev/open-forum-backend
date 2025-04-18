MATCH (u:User {username: $username})
WITH u, date($startDate) AS startDate, date($endDate) AS endDate

// Match Comments
OPTIONAL MATCH (u)-[:AUTHORED_COMMENT]->(comment:Comment)
WHERE date(comment.createdAt) >= startDate AND date(comment.createdAt) <= endDate
WITH u, startDate, endDate, comment

// Match Discussions
OPTIONAL MATCH (u)-[:POSTED_DISCUSSION]->(discussion:Discussion)
WHERE date(discussion.createdAt) >= startDate AND date(discussion.createdAt) <= endDate
WITH u, startDate, endDate, comment, discussion

// Match Events
OPTIONAL MATCH (u)-[:POSTED_BY]->(event:Event)
WHERE date(event.createdAt) >= startDate AND date(event.createdAt) <= endDate
WITH date(COALESCE(comment.createdAt, discussion.createdAt, event.createdAt)) AS activityDate,
     collect(DISTINCT comment) AS comments,
     collect(DISTINCT discussion) AS discussions,
     collect(DISTINCT event) AS events
WHERE activityDate IS NOT NULL

WITH activityDate,
     [c IN comments WHERE c IS NOT NULL] AS filteredComments,
     [d IN discussions WHERE d IS NOT NULL] AS filteredDiscussions,
     [e IN events WHERE e IS NOT NULL] AS filteredEvents

RETURN toString(activityDate) AS date,
       size(filteredComments) + size(filteredDiscussions) + size(filteredEvents) AS count,
       [{
         id: 'activity-' + toString(activityDate),
         type: 'activity',
         description: 'Activity on ' + toString(activityDate),
         Comments: [c IN filteredComments | {
           id: c.id,
           text: COALESCE(c.text, ""),
           createdAt: toString(c.createdAt)
         }],
         Discussions: [d IN filteredDiscussions | {
           id: d.id,
           title: COALESCE(d.title, ""),
           createdAt: toString(d.createdAt)
         }],
         Events: [e IN filteredEvents | {
           id: e.id,
           title: COALESCE(e.title, ""),
           createdAt: toString(e.createdAt)
         }]
       }] AS activities
ORDER BY date ASC