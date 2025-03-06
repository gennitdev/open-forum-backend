import { getCommentRepliesQuery } from "../cypher/cypherQueries.js";
const commentSelectionSet = `
 {
    ChildCommentsAggregate {
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
        archived
        ChildCommentsAggregate {
            count
        }
        FeedbackComments {
          id
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
    const { driver, Comment } = input;
    return async (parent, args, context, info) => {
        const { commentId, modName, offset, limit, sort } = args;
        const session = driver.session();
        try {
            let commentsResult = [];
            let aggregateCount = 0;
            if (sort === "new") {
                // if sort is "new", get the comments sorted by createdAt.
                commentsResult = await Comment.find({
                    where: {
                        id: commentId,
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
                if (commentsResult.length === 0) {
                    return {
                        ChildComments: [],
                        aggregateChildCommentCount: 0,
                    };
                }
                const childCommentData = commentsResult[0];
                commentsResult = childCommentData.ChildComments;
                aggregateCount = childCommentData.ChildCommentsAggregate.count;
            }
            else if (sort === "top") {
                // if sort is "top", get the comments sorted by weightedVotesCount.
                // Treat a null weightedVotesCount as 0.
                const topCommentsResult = await session.run(getCommentRepliesQuery, {
                    commentId,
                    modName,
                    offset: parseInt(offset, 10),
                    limit: parseInt(limit, 10),
                    sortOption: "top",
                });
                if (topCommentsResult.records.length === 0) {
                    return {
                        ChildComments: [],
                        aggregateChildCommentCount: 0,
                    };
                }
                commentsResult = topCommentsResult.records.map((record) => {
                    return record.get("ChildComments");
                });
                aggregateCount = await Comment.aggregate({
                    where: {
                        ParentComment: {
                            id: commentId,
                        },
                    },
                    aggregate: {
                        count: true,
                    },
                }).then((result) => {
                    return result.count;
                });
            }
            else {
                // if sort is "hot", get the comments sorted by hotness,
                // which takes into account both weightedVotesCount and createdAt.
                const hotCommentsResult = await session.run(getCommentRepliesQuery, {
                    commentId,
                    modName,
                    offset: parseInt(offset, 10),
                    limit: parseInt(limit, 10),
                    sortOption: "hot",
                });
                commentsResult = hotCommentsResult.records.map((record) => {
                    return record.get("ChildComments");
                });
                aggregateCount = await Comment.aggregate({
                    where: {
                        ParentComment: {
                            id: commentId,
                        },
                    },
                    aggregate: {
                        count: true,
                    },
                }).then((result) => {
                    return result.count;
                });
            }
            return {
                ChildComments: commentsResult,
                aggregateChildCommentCount: aggregateCount || 0,
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
