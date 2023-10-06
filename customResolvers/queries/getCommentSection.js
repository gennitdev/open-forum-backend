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

      if (sort === "new") {
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
      } else if (sort === "top") {
        // if sort is "top", get the comments sorted by weightedVotesCount.
        // todo: use a custom cypher query so that weightedVotesCount is
        // zero by default.
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
              weightedVotesCount: "DESC",
            },
          },
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
