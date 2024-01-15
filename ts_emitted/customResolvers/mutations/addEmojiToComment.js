import { updateEmoji } from "./updateEmoji";
const getResolver = (input) => {
    const { Comment } = input;
    return async (parent, args, context, resolveInfo) => {
        const { commentId, emojiLabel, unicode, username } = args;
        if (!commentId || !emojiLabel || !unicode || !username) {
            throw new Error("All arguments (commentId, emojiLabel, unicode, username) are required");
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
            const updatedEmojiJSON = updateEmoji(comment.emoji, {
                emojiLabel,
                unicode,
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
export default getResolver;
