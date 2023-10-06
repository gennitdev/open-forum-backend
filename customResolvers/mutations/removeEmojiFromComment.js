const getRemoveEmojiResolver = ({ Comment, driver }) => {
    return async (parent, args, context, resolveInfo) => {
      const { commentId, emojiLabel, username } = args;
  
      if (!commentId || !emojiLabel || !username) {
        throw new Error("All arguments (commentId, emojiLabel, username) are required");
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
  
        // Parse the emoji JSON if it exists
        if (comment.emoji) {
          emoji = JSON.parse(comment.emoji);
        }
  
        // Check if the emoji label exists
        if (emoji[emojiLabel]) {
          for (const unicode in emoji[emojiLabel]) {
            const userIndex = emoji[emojiLabel][unicode].indexOf(username);
  
            // If username exists, remove it
            if (userIndex > -1) {
              emoji[emojiLabel][unicode].splice(userIndex, 1);
  
              // Remove empty arrays
              if (emoji[emojiLabel][unicode].length === 0) {
                delete emoji[emojiLabel][unicode];
              }
            }
          }
  
          // Remove empty objects
          if (Object.keys(emoji[emojiLabel]).length === 0) {
            delete emoji[emojiLabel];
          }
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
  
  module.exports = getRemoveEmojiResolver;
  