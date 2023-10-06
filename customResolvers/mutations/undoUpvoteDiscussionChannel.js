const { discussionChannelIsUpvotedByUserQuery } = require("../cypher/cypherQueries");
const { getWeightedVoteBonus } = require("./utils");

const undoUpvoteDiscussionChannelResolver = ({ DiscussionChannel, User, driver }) => {
  return async (parent, args, context, resolveInfo) => {
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
        throw new Error(
          "Can't undo upvote because you haven't upvoted this discussion yet"
        );
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

      const postAuthorUsername = discussionChannel.Discussion?.Author?.username;
      const postAuthorKarma = discussionChannel.Discussion?.Author?.discussionKarma || 0;

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
        throw new Error(
          "User data not found for the user who is undoing the upvote"
        );
      }

      const voterUser = voterUserResult[0];

      let weightedVoteBonus = getWeightedVoteBonus(voterUser);

      // Update weighted votes count on the discussionChannel and remove the relationship
      const undoUpvoteDiscussionChannelQuery = `
       MATCH (dc:DiscussionChannel { id: $discussionChannelId })<-[r:UPVOTED_DISCUSSION]-(u:User { username: $username })
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

      return {
        id: discussionChannelId,
        weightedVotesCount: discussionChannel.weightedVotesCount - 1 - weightedVoteBonus,
      };
    } catch (e) {
      if (tx) {
        try {
          await tx.rollback();
        } catch (rollbackError) {
          console.error("Failed to rollback transaction", rollbackError);
        }
      }
      console.error(e);
    } finally {
      if (session) {
        try {
          session.close();
        } catch (sessionCloseError) {
          console.error("Failed to close session", sessionCloseError);
        }
      }
    }
  };
};

module.exports = undoUpvoteDiscussionChannelResolver;
