import { discussionChannelIsUpvotedByUserQuery, } from "../cypher/cypherQueries.js";
import { getWeightedVoteBonus } from "./utils.js";
const undoUpvoteDiscussionChannelResolver = (input) => {
    const { DiscussionChannel, User, driver } = input;
    return async (parent, args, context, resolveInfo) => {
        var _a, _b, _c, _d, _e;
        const { discussionChannelId, username } = args;
        if (!discussionChannelId || !username) {
            throw new Error("All arguments (discussionChannelId, username) are required");
        }
        const session = driver.session();
        const tx = session.beginTransaction();
        try {
            const result = await tx.run(discussionChannelIsUpvotedByUserQuery, {
                username,
                discussionChannelId,
            });
            const singleRecord = result.records[0];
            const upvotedByUser = singleRecord.get("result").upvotedByUser;
            if (!upvotedByUser) {
                throw new Error("Can't undo upvote because you haven't upvoted this discussion yet");
            }
            // Fetch discussionChannel
            const discussionChannelSelectionSet = `
        {
          id
          Discussion {
              Author {
                  username
                  discussionKarma
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
            const discussionChannelResult = await DiscussionChannel.find({
                where: {
                    id: discussionChannelId,
                },
                selectionSet: discussionChannelSelectionSet,
            });
            if (discussionChannelResult.length === 0) {
                throw new Error("DiscussionChannel not found");
            }
            const discussionChannel = discussionChannelResult[0];
            const postAuthorUsername = (_b = (_a = discussionChannel.Discussion) === null || _a === void 0 ? void 0 : _a.Author) === null || _b === void 0 ? void 0 : _b.username;
            const postAuthorKarma = ((_d = (_c = discussionChannel.Discussion) === null || _c === void 0 ? void 0 : _c.Author) === null || _d === void 0 ? void 0 : _d.discussionKarma) || 0;
            // Fetch data of the user who is upvoting the discussionChannel
            // because we need it to calculate the weighted vote bonus.
            const userSelectionSet = `
      {
          username
          discussionKarma
      }
     `;
            const voterUserResult = await User.find({
                where: {
                    username,
                },
                selectionSet: userSelectionSet,
            });
            if (voterUserResult.length === 0) {
                throw new Error("User data not found for the user who is undoing the upvote");
            }
            const voterUser = voterUserResult[0];
            let weightedVoteBonus = getWeightedVoteBonus(voterUser);
            // Update weighted votes count on the discussionChannel and remove the relationship
            const undoUpvoteDiscussionChannelQuery = `
        MATCH (u:User { username: $username })-[r:UPVOTED_DISCUSSION]->(dc:DiscussionChannel { id: $discussionChannelId })
        SET dc.weightedVotesCount = coalesce(dc.weightedVotesCount, 0) - 1 - $weightedVoteBonus
        DELETE r
        RETURN dc
     `;
            await tx.run(undoUpvoteDiscussionChannelQuery, {
                discussionChannelId,
                username,
                weightedVoteBonus,
            });
            // Update the post author's karma
            if (postAuthorUsername) {
                await User.update({
                    where: { username: postAuthorUsername },
                    update: { discussionKarma: postAuthorKarma - 1 },
                });
            }
            await tx.commit();
            const existingUpvotedByUsers = discussionChannel.UpvotedByUsers || [];
            const existingUpvotedByUsersCount = ((_e = discussionChannel.UpvotedByUsersAggregate) === null || _e === void 0 ? void 0 : _e.count) || 0;
            return {
                id: discussionChannelId,
                weightedVotesCount: discussionChannel.weightedVotesCount - 1 - weightedVoteBonus,
                UpvotedByUsers: existingUpvotedByUsers.filter((user) => user.username !== username),
                UpvotedByUsersAggregate: {
                    count: existingUpvotedByUsersCount - 1,
                },
            };
        }
        catch (e) {
            if (tx) {
                try {
                    await tx.rollback();
                }
                catch (rollbackError) {
                    console.error("Failed to rollback transaction", rollbackError);
                }
            }
            console.error(e);
        }
        finally {
            if (session) {
                try {
                    session.close();
                }
                catch (sessionCloseError) {
                    console.error("Failed to close session", sessionCloseError);
                }
            }
        }
    };
};
export default undoUpvoteDiscussionChannelResolver;
