import { getEventCommentsQuery, } from "../cypher/cypherQueries.js";
const eventSelectionSet = `
  {
    id
    title
    description
    startTime
    endTime
    locationName
    address
    virtualEventUrl
    startTimeDayOfWeek
    startTimeHourOfDay
    canceled
    isHostedByOP
    isAllDay
    coverImageURL
    createdAt
    updatedAt
    placeId
    isInPrivateResidence
    cost
  }
  `;
const commentSelectionSet = `
              {
                  id
                  text
                  emoji
                  weightedVotesCount
                  CommentAuthor {
                      ... on User {
                          username
                          displayName
                          profilePicURL
                          commentKarma
                          createdAt
                          discussionKarma
                          ServerRoles {
                            showAdminTag
                          }
                          ChannelRoles {
                            showModTag
                          }
                      }
                  }
                  createdAt
                  updatedAt
                  ChildCommentsAggregate {
                      count
                  }
                  ParentComment {
                      id
                  }
                  UpvotedByUsers {
                      username
                  }
                  UpvotedByUsersAggregate {
                      count
                  }
                  ChildComments {
                      id
                      text
                      emoji
                      weightedVotesCount
                      CommentAuthor {
                          ... on User {
                              username
                              displayName
                              profilePicURL
                              commentKarma
                              createdAt
                              discussionKarma
                              ServerRoles {
                                showAdminTag
                              }
                              ChannelRoles {
                                showModTag
                              }
                          }
                      }
                      createdAt
                      updatedAt
                      ChildCommentsAggregate {
                          count
                      }
                      ParentComment {
                          id
                      }
                      UpvotedByUsers {
                          username
                      }
                      UpvotedByUsersAggregate {
                          count
                      }
                  }
              }
          `;
const getResolver = (input) => {
    const { driver, Event, Comment } = input;
    return async (parent, args, context, info) => {
        const { eventId, offset, limit, sort } = args;
        const session = driver.session();
        try {
            const result = await Event.find({
                where: {
                    id: eventId,
                },
                // get everything about the Event
                // except the comments
                selectionSet: eventSelectionSet,
            });
            if (result.length === 0) {
                throw new Error("Event not found");
            }
            const event = result[0];
            let commentsResult = [];
            if (sort === "new") {
                // if sort is "new", get the comments sorted by createdAt.
                commentsResult = await Comment.find({
                    where: {
                        isRootComment: true,
                        Event: {
                            id: eventId,
                        },
                    },
                    selectionSet: commentSelectionSet,
                    options: {
                        offset,
                        limit,
                        sort: {
                            createdAt: "DESC",
                        },
                    },
                });
            }
            else if (sort === "top") {
                // if sort is "top", get the comments sorted by weightedVotesCount.
                // Treat a null weightedVotesCount as 0.
                commentsResult = await session.run(getEventCommentsQuery, {
                    eventId,
                    offset: parseInt(offset, 10),
                    limit: parseInt(limit, 10),
                    sortOption: "top",
                });
                commentsResult = commentsResult.records.map((record) => {
                    return record.get("comment");
                });
            }
            else {
                // if sort is "hot", get the comments sorted by hot,
                // which takes into account both weightedVotesCount and createdAt.
                commentsResult = await session.run(getEventCommentsQuery, {
                    eventId,
                    offset: parseInt(offset, 10),
                    limit: parseInt(limit, 10),
                    sortOption: "hot",
                });
                commentsResult = commentsResult.records.map((record) => {
                    return record.get("comment");
                });
            }
            return {
                Event: event,
                Comments: commentsResult,
            };
        }
        catch (error) {
            console.error("Error getting comment section:", error);
            throw new Error(`Failed to fetch comment section. ${error.message}`);
        }
        finally {
            session.close();
        }
    };
};
export default getResolver;
