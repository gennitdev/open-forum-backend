const { removeEmoji } = require("./updateEmoji");

const getRemoveEmojiResolver = ({ DiscussionChannel }) => {
  return async (parent, args, context, resolveInfo) => {
    const { discussionChannelId, emojiLabel, username } = args;

    if (!discussionChannelId || !emojiLabel || !username) {
      throw new Error(
        "All arguments (discussionChannelId, emojiLabel, username) are required"
      );
    }

    try {
      const result = await DiscussionChannel.find({
        where: {
          id: discussionChannelId,
        },
      });

      if (result.length === 0) {
        throw new Error("DiscussionChannel not found");
      }

      const discussionChannel = result[0];
      const updatedEmojiJSON = removeEmoji(discussionChannel.emoji, {
        emojiLabel,
        username,
      });

      await DiscussionChannel.update({
        where: {
          id: discussionChannelId,
        },
        update: {
          emoji: updatedEmojiJSON,
        },
      });

      return {
        id: discussionChannelId,
        emoji: updatedEmojiJSON,
      };
    } catch (e) {
      console.error(e);
    }
  };
};
module.exports = getRemoveEmojiResolver;