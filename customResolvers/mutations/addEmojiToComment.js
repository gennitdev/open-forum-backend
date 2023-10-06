const getResolver = ({ Comment, driver }) => {
  return async (parent, args, context, resolveInfo) => {
    const { commentId, emojiLabel, unicode, username } = args;

    if (!commentId || !emojiLabel || !unicode || !username) {
      throw new Error(
        "All arguments (commentId, emojiLabel, unicode, username) are required"
      );
    }

    const getCommentSelectionSet = `
        {
            id
            emoji
        }
    `;

    try {
      // Get the comment
      const result = await Comment.find({
        where: {
          id: commentId,
        },
        selectionSet: getCommentSelectionSet,
      });
      if (result.length === 0) {
        throw new Error("Comment not found");
      }
      const comment = result[0];
      let emoji = {};

      // Parse the emoji JSON.
      // Example JSON:
      // '{"eyes": {"👀": ["cluse"]}, "apple": {"🍎": ["alice","bob","cluse","another","one","something","else"]}}',
      if (comment.emoji) {
        emoji = JSON.parse(comment.emoji);
      }

      // If the emoji label is not in the emoji JSON, add it.
      if (!emoji[emojiLabel]) {
        emoji[emojiLabel] = {};
      }
      // If the unicode is not in the emoji JSON, add it.
      if (!emoji[emojiLabel][unicode]) {
        emoji[emojiLabel][unicode] = [];
      }
      // If the username is not in the emoji JSON, add it.
      if (!emoji[emojiLabel][unicode].includes(username)) {
        emoji[emojiLabel][unicode].push(username);
      }
      const emojiJSON = JSON.stringify(emoji);

      // Update the comment
      await Comment.update({
        where: {
          id: commentId,
        },
        update: {
          emoji: emojiJSON,
        },
      });

      return {
        id: commentId,
        emoji: emojiJSON,
      };
    } catch (e) {
      console.error(e);
    }
  };
};

module.exports = getResolver;
