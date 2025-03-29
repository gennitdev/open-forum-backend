import { commentIsUpvotedByUserQuery } from "../cypher/cypherQueries.js";
import { getWeightedVoteBonus } from "./utils.js";
const undoUpvoteCommentResolver = (input) => {
    const { Comment, User, driver } = input;
    return async (parent, args, context, resolveInfo) => {
        var _a, _b, _c;
        const { commentId, username } = args;
        if (!commentId || !username) {
            throw new Error("All arguments (commentId, username) are required");
        }
        const session = driver.session();
        const tx = session.beginTransaction();
        try {
            const result = await tx.run(commentIsUpvotedByUserQuery, {
                username,
                commentId,
            });
            const singleRecord = result.records[0];
            if (!singleRecord) {
                throw new Error("Comment not found");
            }
            const upvotedByUser = (_a = singleRecord.get("result")) === null || _a === void 0 ? void 0 : _a.upvotedByUser;
            if (!upvotedByUser) {
                throw new Error("Can't undo upvote because you haven't upvoted this comment yet");
            }
            const commentSelectionSet = `
        {
          id
          CommentAuthor {
              ... on User {
                  username
                  commentKarma
                  createdAt
              }
              ... on ModerationProfile {
                displayName
                createdAt
              }
          }
          weightedVotesCount
          UpvotedByUsers {
              username
          }
          UpvotedByUsersAggregate {
              count
          }
        }
      `;
            const commentResult = await Comment.find({
                where: {
                    id: commentId,
                },
                selectionSet: commentSelectionSet,
            });
            if (commentResult.length === 0) {
                throw new Error("Comment not found");
            }
            const comment = commentResult[0];
            const postAuthorUsername = (_b = comment.CommentAuthor) === null || _b === void 0 ? void 0 : _b.username;
            const postAuthorKarma = ((_c = comment.CommentAuthor) === null || _c === void 0 ? void 0 : _c.commentKarma) || 0;
            const userSelectionSet = `
      {
          username
          commentKarma
      }
     `;
            const voterUserResult = await User.find({
                where: {
                    username,
                },
                selectionSet: userSelectionSet,
            });
            if (voterUserResult.length === 0) {
                throw new Error("User data not found for the user who is undoing the upvote");
            }
            const voterUser = voterUserResult[0];
            let weightedVoteBonus = getWeightedVoteBonus(voterUser);
            const undoUpvoteCommentQuery = `
       MATCH (u:User { username: $username })-[r:UPVOTED_COMMENT]->(c:Comment { id: $commentId })
       SET c.weightedVotesCount = coalesce(c.weightedVotesCount, 0) - 1 - $weightedVoteBonus
       DELETE r
       RETURN c
     `;
            await tx.run(undoUpvoteCommentQuery, {
                commentId,
                username,
                weightedVoteBonus,
            });
            if (postAuthorUsername) {
                await User.update({
                    where: { username: postAuthorUsername },
                    update: { commentKarma: postAuthorKarma - 1 },
                });
            }
            await tx.commit();
            const existingUpvotedByUsers = comment.UpvotedByUsers || [];
            const existingUpvotedByUsersAggregate = comment.UpvotedByUsersAggregate || { count: 0 };
            const returnValue = {
                id: commentId,
                weightedVotesCount: comment.weightedVotesCount - 1 - weightedVoteBonus,
                UpvotedByUsers: existingUpvotedByUsers.filter((user) => user.username !== username),
                UpvotedByUsersAggregate: {
                    count: existingUpvotedByUsersAggregate.count - 1,
                },
            };
            return returnValue;
        }
        catch (e) {
            console.error("Error in undoUpvoteComment:", e);
            if (tx) {
                try {
                    await tx.rollback();
                }
                catch (rollbackError) {
                    console.error("Failed to rollback transaction", rollbackError);
                }
            }
            throw e; // Re-throw the error after logging
        }
        finally {
            if (session) {
                try {
                    session.close();
                }
                catch (sessionCloseError) {
                    console.error("Failed to close session", sessionCloseError);
                }
            }
        }
    };
};
export default undoUpvoteCommentResolver;
