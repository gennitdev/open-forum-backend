import { getCommentsQuery, } from "../cypher/cypherQueries.js";
const discussionChannelSelectionSet = `
{
    id
    createdAt
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
            displayName
            profilePicURL
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
    const { driver, DiscussionChannel, Comment } = input;
    return async (parent, args, context, info) => {
        const { channelUniqueName, discussionId, modName, offset, limit, sort } = args;
        console.log('mod name is ', modName);
        const session = driver.session();
        try {
            const result = await DiscussionChannel.find({
                where: {
                    discussionId,
                    channelUniqueName,
                },
                // get everything about the DiscussionChannel
                // except the comments
                selectionSet: discussionChannelSelectionSet,
            });
            if (result.length === 0) {
                throw new Error("DiscussionChannel not found");
            }
            const discussionChannel = result[0];
            const discussionChannelId = discussionChannel.id;
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
            }
            else if (sort === "top") {
                // if sort is "top", get the comments sorted by weightedVotesCount.
                // Treat a null weightedVotesCount as 0.
                commentsResult = await session.run(getCommentsQuery, {
                    discussionChannelId,
                    modName,
                    offset: parseInt(offset, 10),
                    limit: parseInt(limit, 10),
                    sortOption: "top"
                });
                commentsResult = commentsResult.records.map((record) => {
                    return record.get("comment");
                });
            }
            else {
                // if sort is "hot", get the comments sorted by hotness,
                // which takes into account both weightedVotesCount and createdAt.
                commentsResult = await session.run(getCommentsQuery, {
                    discussionChannelId,
                    modName,
                    offset: parseInt(offset, 10),
                    limit: parseInt(limit, 10),
                    sortOption: "hot"
                });
                commentsResult = commentsResult.records.map((record) => {
                    return record.get("comment");
                });
                console.log('comments result is ', commentsResult[0]);
            }
            return {
                DiscussionChannel: discussionChannel,
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
