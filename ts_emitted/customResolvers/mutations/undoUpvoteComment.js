import { commentIsUpvotedByUserQuery } from "../cypher/cypherQueries.js";
import { getWeightedVoteBonus } from "./utils.js";
const undoUpvoteCommentResolver = (input) => {
    const { Comment, User, driver } = input;
    return async (parent, args, context, resolveInfo) => {
        var _a, _b, _c;
        console.log("Starting undoUpvoteComment with args:", args);
        const { commentId, username } = args;
        if (!commentId || !username) {
            console.log("Missing required arguments:", { commentId, username });
            throw new Error("All arguments (commentId, username) are required");
        }
        const session = driver.session();
        console.log("Created new session");
        const tx = session.beginTransaction();
        console.log("Started new transaction");
        try {
            console.log("Running commentIsUpvotedByUserQuery with params:", { username, commentId });
            const result = await tx.run(commentIsUpvotedByUserQuery, {
                username,
                commentId,
            });
            console.log("Query result:", JSON.stringify(result, null, 2));
            const singleRecord = result.records[0];
            console.log("First record:", JSON.stringify(singleRecord, null, 2));
            if (!singleRecord) {
                console.log("No record found for comment:", commentId);
                throw new Error("Comment not found");
            }
            const upvotedByUser = (_a = singleRecord.get("result")) === null || _a === void 0 ? void 0 : _a.upvotedByUser;
            console.log("upvotedByUser value:", upvotedByUser);
            if (!upvotedByUser) {
                console.log("User has not upvoted this comment");
                throw new Error("Can't undo upvote because you haven't upvoted this comment yet");
            }
            console.log("Fetching comment details with selection set");
            console.log("Comment model:", Comment);
            console.log("Comment model methods:", Object.keys(Comment));
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
            console.log("About to execute Comment.find with params:", {
                where: { id: commentId },
                selectionSet: commentSelectionSet
            });
            const commentResult = await Comment.find({
                where: {
                    id: commentId,
                },
                selectionSet: commentSelectionSet,
            });
            console.log("Comment result:", JSON.stringify(commentResult, null, 2));
            if (commentResult.length === 0) {
                console.log("No comment found with ID:", commentId);
                throw new Error("Comment not found");
            }
            const comment = commentResult[0];
            console.log("Found comment:", JSON.stringify(comment, null, 2));
            const postAuthorUsername = (_b = comment.CommentAuthor) === null || _b === void 0 ? void 0 : _b.username;
            const postAuthorKarma = ((_c = comment.CommentAuthor) === null || _c === void 0 ? void 0 : _c.commentKarma) || 0;
            console.log("Post author details:", { postAuthorUsername, postAuthorKarma });
            console.log("Fetching voter user details");
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
            console.log("Voter user result:", JSON.stringify(voterUserResult, null, 2));
            if (voterUserResult.length === 0) {
                console.log("No voter user found for username:", username);
                throw new Error("User data not found for the user who is undoing the upvote");
            }
            const voterUser = voterUserResult[0];
            console.log("Found voter user:", JSON.stringify(voterUser, null, 2));
            let weightedVoteBonus = getWeightedVoteBonus(voterUser);
            console.log("Calculated weighted vote bonus:", weightedVoteBonus);
            console.log("Running undoUpvoteCommentQuery");
            const undoUpvoteCommentQuery = `
       MATCH (u:User { username: $username })-[r:UPVOTED_COMMENT]->(c:Comment { id: $commentId })
       SET c.weightedVotesCount = coalesce(c.weightedVotesCount, 0) - 1 - $weightedVoteBonus
       DELETE r
       RETURN c
     `;
            const undoResult = await tx.run(undoUpvoteCommentQuery, {
                commentId,
                username,
                weightedVoteBonus,
            });
            console.log("Undo query result:", JSON.stringify(undoResult, null, 2));
            if (postAuthorUsername) {
                console.log("Updating post author karma");
                await User.update({
                    where: { username: postAuthorUsername },
                    update: { commentKarma: postAuthorKarma - 1 },
                });
            }
            console.log("Committing transaction");
            await tx.commit();
            const existingUpvotedByUsers = comment.UpvotedByUsers || [];
            const existingUpvotedByUsersAggregate = comment.UpvotedByUsersAggregate || { count: 0 };
            console.log("Existing upvoted users:", JSON.stringify(existingUpvotedByUsers, null, 2));
            console.log("Existing upvoted users aggregate:", JSON.stringify(existingUpvotedByUsersAggregate, null, 2));
            const returnValue = {
                id: commentId,
                weightedVotesCount: comment.weightedVotesCount - 1 - weightedVoteBonus,
                UpvotedByUsers: existingUpvotedByUsers.filter((user) => user.username !== username),
                UpvotedByUsersAggregate: {
                    count: existingUpvotedByUsersAggregate.count - 1,
                },
            };
            console.log("Returning value:", JSON.stringify(returnValue, null, 2));
            return returnValue;
        }
        catch (e) {
            console.error("Error in undoUpvoteComment:", e);
            if (tx) {
                try {
                    console.log("Rolling back transaction");
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
                    console.log("Closing session");
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
