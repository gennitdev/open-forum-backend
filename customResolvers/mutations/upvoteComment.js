const math = require("mathjs");
const { DateTime } = require("luxon");
const { commentIsUpvotedByUserQuery } = require("../cypher/cypherQueries");

const getAccountAgeInMonths = (createdAt) => {
  const now = DateTime.now();
  const accountCreated = DateTime.fromJSDate(new Date(createdAt)); // Assuming createdAt is a JavaScript Date object
  const diff = now.diff(accountCreated, ["months"]).months;

  // Rounding down to the nearest whole month
  const accountAgeInMonths = Math.floor(diff);

  return accountAgeInMonths;
};

const upvoteCommentResolver = ({ Comment, User, driver }) => {
  return async (parent, args, context, resolveInfo) => {
    const { commentId, username } = args;

    if (!commentId || !username) {
      throw new Error("All arguments (commentId, username) are required");
    }
    const session = driver.session();

    const checkUserUpvoted = async (username, commentId) => {
      const params = {
        username,
        commentId,
      };

      const result = await session.run(commentIsUpvotedByUserQuery, params);
      const singleRecord = result.records[0];
      const upvotedByUser = singleRecord.get("result").upvotedByUser;
      session.close();

      return {
        upvotedByUser,
      };
    };

    const { upvotedByUser } = await checkUserUpvoted(username, commentId);
    if (upvotedByUser) {
      throw new Error("You have already upvoted this comment");
    }

    try {
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

      if (postAuthorUsername === username) {
        throw new Error("You cannot upvote your own comment");
      }

      // Fetch data of the user who is upvoting the comment
      // because we need it to calculate the weighted vote bonus.
      const userSelectionSet = `
      {
          username
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

      let weightedVoteBonus = 0;
      let accountAgeInMonths = getAccountAgeInMonths(upvoterUser.createdAt);
      let commentKarma = 1;

      // Votes count more if the account has more comment karma.
      if (upvoterUser.commentKarma && upvoterUser.commentKarma > 0) {
        commentKarma = upvoterUser.commentKarma;
        weightedVoteBonus += math.log(commentKarma, 10);
      }

      // Votes count more if the account is older.
      if (accountAgeInMonths > 0) {
        weightedVoteBonus += math.log(accountAgeInMonths, 10);
      }

      // Update weighted votes count on the comment
      // and create a relationship between the user and the comment.
      const updateCommentQuery = `
        MATCH (c:Comment { id: $commentId }), (u:User { username: $username })
        SET c.weightedVotesCount = c.weightedVotesCount + 1 + $weightedVoteBonus
        CREATE (u)-[:UPVOTED_COMMENT]->(c)
        RETURN c
      `;

      const params = {
        commentId,
        username,
        weightedVoteBonus,
      };
      const session = driver.session();
      await session.run(updateCommentQuery, params);

      // Update the post author's karma
      if (postAuthorUsername) {
        await User.update({
          where: { username: postAuthorUsername },
          update: { commentKarma: postAuthorKarma + 1 },
        });
      }

      return {
        id: commentId,
        weightedVotesCount: comment.weightedVotesCount + 1 + weightedVoteBonus,
      };
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      session.close();
    }
  };
};

module.exports = upvoteCommentResolver;
