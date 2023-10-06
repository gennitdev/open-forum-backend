const {
  getDiscussionChannelWithCommentsQuery,
} = require("../cypher/cypherQueries");

const getResolver = ({ driver, DiscussionChannel, Comment }) => {
  return async (parent, args, context, info) => {
    const { channelUniqueName, discussionId, offset, limit, sort } = args;

    const session = driver.session();

    try {
      const result = await DiscussionChannel.find({
        where: {
          discussionId,
          channelUniqueName,
        },
        // get everything about the DiscussionChannel
        // except the comments
        selectionSet: `
                {
                    id
                    weightedVotesCount
                    discussionId
                    channelUniqueName
                    emoji
                    Channel {
                        uniqueName
                    }
                    Discussion {
                        id
                        title
                        Author {
                            username
                            commentKarma
                            createdAt
                            discussionKarma
                        }
                    }
                    CommentsAggregate {
                        count
                    }
                    UpvotedByUsers {
                        username
                    }
                    UpvotedByUsersAggregate {
                        count
                    }
                    DownvotedByModerators {
                        displayName
                    }
                    DownvotedByModeratorsAggregate {
                        count
                    }
                }
            `,
      });

      console.log('discussion channel result is ', result)

      if (result.length === 0) {
        throw new Error("DiscussionChannel not found");
      }

      const discussionChannel = result[0];
      const discussionChannelId = discussionChannel.id;

      const commentSelectionSet = `
            {
                id
                text
                emoji
                weightedVotesCount
                CommentAuthor {
                    ... on User {
                        username
                        commentKarma
                        createdAt
                        discussionKarma
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
                DownvotedByModerators {
                    displayName
                }
                DownvotedByModeratorsAggregate {
                    count
                }
            }
        `;
      let commentsResult = [];

      if (sort === "NEW") {
        // if sort is "new", get the comments sorted by createdAt.
        commentsResult = await Comment.find({
          where: {
            isRootComment: true,
            DiscussionChannel: {
              id: discussionChannelId,
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
        console.log('new comments result is ', commentsResult)
      } else if (sort === "TOP") {

        console.log('args are ', args)
        // if sort is "top", get the comments sorted by weightedVotesCount.
        const cypherQuery = `
                MATCH (dc:DiscussionChannel { id: $discussionChannelId })-[:CONTAINS_COMMENT]->(c:Comment)
                WHERE c.isRootComment = true
                RETURN c
                ORDER BY coalesce(c.weightedVotesCount, 0) DESC
                SKIP toInteger($offset)
                LIMIT toInteger($limit)
        `;
        
    
        commentsResult = await session.run(cypherQuery, {
            discussionChannelId,
            offset: parseInt(offset, 10),
            limit: parseInt(limit, 10),
        })

        commentsResult = commentsResult.records.map(record => {
                return record.get('c').properties;
            });
     console.log('top comments result is ', commentsResult)
        
    } else {
        // Will implement "hot" sort later
      }

      return {
        ...discussionChannel,
        Comments: commentsResult,
      };
    } catch (error) {
      console.error("Error getting comment section:", error);
      throw new Error(`Failed to fetch comment section. ${error.message}`);
    } finally {
      session.close();
    }
  };
};

module.exports = getResolver;
