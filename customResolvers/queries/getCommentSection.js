const {
  getTopCommentsQuery,
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

      
      let commentsResult = [];

      if (sort === "new") {
        // if sort is "new", get the comments sorted by createdAt.
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
                ChildComments {
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
            }
        `;
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
      } else if (sort === "top") {

        console.log('args are ', args)
        // if sort is "top", get the comments sorted by weightedVotesCount.
        // Treat a null weightedVotesCount as 0.    
        commentsResult = await session.run(getTopCommentsQuery, {
            discussionChannelId,
            offset: parseInt(offset, 10),
            limit: parseInt(limit, 10),
        })

        commentsResult = commentsResult.records.map((record) => {
            return record.get("comment")
        })

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
