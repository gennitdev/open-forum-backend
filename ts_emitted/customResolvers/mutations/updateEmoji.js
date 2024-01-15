export const updateEmoji = (emojiJSON, input) => {
    const { emojiLabel, unicode, username } = input;
    let emoji = {};
    // Parse the existing emoji JSON
    if (emojiJSON) {
        emoji = JSON.parse(emojiJSON);
    }
    // Add emoji label, unicode and username if not exist
    if (!emoji[emojiLabel]) {
        emoji[emojiLabel] = {};
    }
    if (!emoji[emojiLabel][unicode]) {
        emoji[emojiLabel][unicode] = [];
    }
    if (!emoji[emojiLabel][unicode].includes(username)) {
        emoji[emojiLabel][unicode].push(username);
    }
    // Convert updated emoji back to JSON
    return JSON.stringify(emoji);
};
export const removeEmoji = (emojiJSON, input) => {
    const { emojiLabel, username } = input;
    let emoji = {};
    if (emojiJSON) {
        emoji = JSON.parse(emojiJSON);
    }
    if (emoji[emojiLabel]) {
        for (const unicode in emoji[emojiLabel]) {
            const userIndex = emoji[emojiLabel][unicode].indexOf(username);
            if (userIndex > -1) {
                emoji[emojiLabel][unicode].splice(userIndex, 1);
                if (emoji[emojiLabel][unicode].length === 0) {
                    delete emoji[emojiLabel][unicode];
                }
            }
        }
        if (Object.keys(emoji[emojiLabel]).length === 0) {
            delete emoji[emojiLabel];
        }
    }
    return JSON.stringify(emoji);
};
