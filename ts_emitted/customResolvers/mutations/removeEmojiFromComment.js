import { removeEmoji } from "./updateEmoji";
const getRemoveEmojiResolver = (input) => {
    const { Comment } = input;
    return async (parent, args, context, resolveInfo) => {
        const { commentId, emojiLabel, username } = args;
        if (!commentId || !emojiLabel || !username) {
            throw new Error("All arguments (commentId, emojiLabel, username) are required");
        }
        try {
            const result = await Comment.find({
                where: {
                    id: commentId,
                },
            });
            if (result.length === 0) {
                throw new Error("Comment not found");
            }
            const comment = result[0];
            const updatedEmojiJSON = removeEmoji(comment.emoji, {
                emojiLabel,
                username,
            });
            await Comment.update({
                where: {
                    id: commentId,
                },
                update: {
                    emoji: updatedEmojiJSON,
                },
            });
            return {
                id: commentId,
                emoji: updatedEmojiJSON,
            };
        }
        catch (e) {
            console.error(e);
        }
    };
};
export default getRemoveEmojiResolver;
