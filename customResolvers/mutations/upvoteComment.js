const math = require("mathjs");

const upvoteCommentResolver = ({ Comment, User, Post, driver }) => {
  return async (parent, args, context, resolveInfo) => {
    const { commentId, userId } = args;

    if (!commentId || !userId) {
      throw new Error("All arguments (commentId, userId) are required");
    }

    try {
      // Fetch comment and related user
      const commentResult = await Comment.find({
        where: {
          id: commentId,
        },
      });

      if (commentResult.length === 0) {
        throw new Error("Comment not found");
      }

      const comment = commentResult[0];
      const postAuthorId = comment.authorId; // Assuming the comment object has an 'authorId' field

      // Fetch user details
      const userResult = await User.find({
        where: {
          id: userId,
        },
      });

      if (userResult.length === 0) {
        throw new Error("User not found");
      }

      const user = userResult[0];

      // Calculate the weighted vote bonus
      const weightedVoteBonus =
        math.log(user.karma, 10) + math.log(user.accountAgeInMonths, 10);

      // Update weighted votes count on the post
      const postResult = await Post.find({
        where: {
          id: comment.postId,
        },
      });

      if (postResult.length === 0) {
        throw new Error("Post not found");
      }

      const post = postResult[0];
      await Post.update({
        where: { id: comment.postId },
        update: {
          weightedVotesCount: post.weightedVotesCount + 1 + weightedVoteBonus,
        },
      });

      // Update the post author's karma
      await User.update({
        where: { id: postAuthorId },
        update: { karma: post.weightedVotesCount + 1 },
      });

      // Commit the transaction
      await transaction.commit();

      return {
        id: commentId,
        weightedVotesCount: post.weightedVotesCount + 1 + weightedVoteBonus,
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  };
};

module.exports = upvoteCommentResolver;
