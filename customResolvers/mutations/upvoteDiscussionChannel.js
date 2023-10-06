const { discussionChannelIsUpvotedByUserQuery } = require("../cypher/cypherQueries");
const { getWeightedVoteBonus } = require("./utils");

const upvoteDiscussionChannelResolver = ({ DiscussionChannel, User, driver }) => {
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

      if (upvotedByUser) {
        throw new Error("You have already upvoted this discussionChannel");
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
      const upvoterUserResult = await User.find({
        where: {
          username,
        },
        selectionSet: userSelectionSet,
      });

      if (upvoterUserResult.length === 0) {
        throw new Error("User not found");
      }

      const upvoterUser = upvoterUserResult[0];

      const weightedVoteBonus = getWeightedVoteBonus(upvoterUser);

      // Update weighted votes count on the discussionChannel
      // and create a relationship between the user and the discussionChannel.
      const updateDiscussionChannelQuery = `
        MATCH (dc:DiscussionChannel { id: $discussionChannelId }), (u:User { username: $username })
        SET dc.weightedVotesCount = coalesce(dc.weightedVotesCount, 0) + 1 + $weightedVoteBonus
        CREATE (dc)-[:UPVOTED_DISCUSSION]->(u)
        RETURN dc
      `;

      await tx.run(updateDiscussionChannelQuery, {
        discussionChannelId,
        username,
        weightedVoteBonus,
      });

      // Update the post author's karma.
      // It may be the case that the post author deleted their account,
      // in which case we don't need to update their karma,
      // but the discussionChannel should still be upvoted.
      if (postAuthorUsername) {
        await User.update({
          where: { username: postAuthorUsername },
          update: { discussionKarma: postAuthorKarma + 1 },
        });
      }

      await tx.commit();

      const existingUpvotedByUsers = discussionChannel.UpvotedByUsers || [];
      const existingUpvotedByUsersAggregate = discussionChannel.UpvotedByUsersAggregate || { count: 0 };

      return {
        id: discussionChannelId,
        weightedVotesCount: discussionChannel.weightedVotesCount + 1 + weightedVoteBonus,
        UpvotedByUsers: [
          ...existingUpvotedByUsers,
          {
            username,
          },
        ],
        UpvotedByUsersAggregate: {
          count: existingUpvotedByUsersAggregate.count + 1,
        },
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

module.exports = upvoteDiscussionChannelResolver;
