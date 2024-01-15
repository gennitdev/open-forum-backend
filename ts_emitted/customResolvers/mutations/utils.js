import { DateTime } from "luxon";
import { log } from "mathjs";
export const getAccountAgeInMonths = (createdAt) => {
    const now = DateTime.now();
    const accountCreated = DateTime.fromJSDate(new Date(createdAt));
    const diff = now.diff(accountCreated, ["months"]).months;
    // Rounding down to the nearest whole month
    const accountAgeInMonths = Math.floor(diff);
    return accountAgeInMonths;
};
export const getWeightedVoteBonus = (user) => {
    let weightedVoteBonus = 0;
    let accountAgeInMonths = getAccountAgeInMonths(user.createdAt);
    let commentKarma = 1;
    // Votes count more if the account has more comment karma.
    if (user.commentKarma && user.commentKarma > 0) {
        commentKarma = user.commentKarma;
        weightedVoteBonus += parseFloat(log(commentKarma, 10).toFixed(5));
    }
    // Votes count more if the account is older.
    if (accountAgeInMonths > 0) {
        weightedVoteBonus += parseFloat(log(accountAgeInMonths, 10).toFixed(5));
    }
    return weightedVoteBonus;
};
