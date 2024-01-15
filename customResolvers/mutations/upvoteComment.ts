import { commentIsUpvotedByUserQuery } from "../cypher/cypherQueries.js";
import { getWeightedVoteBonus } from "./utils.js";

type Input = {
  Comment: any;
  User: any;
  driver: any;
};

type Args = {
  commentId: string;
  username: string;
};

const upvoteCommentResolver = (input: Input) => {
  const { Comment, User, driver } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
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
      const upvotedByUser = singleRecord.get("result").upvotedByUser;

      if (upvotedByUser) {
        throw new Error("You have already upvoted this comment");
      }
      // Fetch comment
      const commentSelectionSet = `
        {
          id
          CommentAuthor {
              ... on User {
                  username
                  commentKarma
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

      const postAuthorUsername = comment.CommentAuthor?.username;
      const postAuthorKarma = comment.CommentAuthor?.commentKarma || 0;

      // Fetch data of the user who is upvoting the comment
      // because we need it to calculate the weighted vote bonus.
      const userSelectionSet = `
      {
          username
          commentKarma
      }
     `;
      const upvoterUserResult = await User.find({
        where: {
          username,
        },
        selectionSet: userSelectionSet,
      });

      if (upvoterUserResult.length === 0) {
        throw new Error("User not found");
      }

      const upvoterUser = upvoterUserResult[0];

      const weightedVoteBonus = getWeightedVoteBonus(upvoterUser);

      // Update weighted votes count on the comment
      // and create a relationship between the user and the comment.
      const updateCommentQuery = `
        MATCH (c:Comment { id: $commentId }), (u:User { username: $username })
        SET c.weightedVotesCount = coalesce(c.weightedVotesCount, 0) + 1 + $weightedVoteBonus
        CREATE (u)-[:UPVOTED_COMMENT]->(c)
        RETURN c
      `;

      await tx.run(updateCommentQuery, {
        commentId,
        username,
        weightedVoteBonus,
      });

      // Update the post author's karma
      if (postAuthorUsername) {
        await User.update({
          where: { username: postAuthorUsername },
          update: { commentKarma: postAuthorKarma + 1 },
        });
      }

      await tx.commit();

      const existingUpvotedByUsers = comment.UpvotedByUsers || [];
      const existingUpvotedByUsersCount = comment.UpvotedByUsersAggregate?.count || 0;

      return {
        id: commentId,
        weightedVotesCount: comment.weightedVotesCount + 1 + weightedVoteBonus,
        UpvotedByUsers: [
          ...existingUpvotedByUsers,
          {
            username,
          },
        ],
        UpvotedByUsersAggregate: {
          count: existingUpvotedByUsersCount + 1,
        },
      };
    } catch (e) {
      if (tx) {
        try {
          await tx.rollback();
        } catch (rollbackError) {
          console.error("Failed to rollback transaction", rollbackError);
        }
      }
      console.error(e);
    } finally {
      if (session) {
        try {
          session.close();
        } catch (sessionCloseError) {
          console.error("Failed to close session", sessionCloseError);
        }
      }
    }
  };
};

export default upvoteCommentResolver;
