const {
  getTopDiscussionChannelsQuery,
  getHotDiscussionChannelsQuery,
} = require("../cypher/cypherQueries");

const discussionChannelSelectionSet = `
  {
      id
      weightedVotesCount
      discussionId
      channelUniqueName
      emoji
      createdAt
      Channel {
          uniqueName
      }
      Discussion {
          id
          title
          body
          createdAt
          updatedAt
          Author {
              username
              commentKarma
              createdAt
              discussionKarma
          }
      }
      CommentsAggregate {
          count
      }
      UpvotedByUsers {
          username
      }
      UpvotedByUsersAggregate {
          count
      }
      DownvotedByModerators {
          displayName
      }
      DownvotedByModeratorsAggregate {
          count
      }
  }
  `;

const getResolver = ({ driver, DiscussionChannel }) => {
  return async (parent, args, context, info) => {
    const { channelUniqueName, offset, limit, sort } = args;

    const session = driver.session();

    try {
      let result = [];

      if (sort === "new") {
        // if sort is "new", get the DiscussionChannels sorted by createdAt.
        result = await DiscussionChannel.find({
          where: {
            channelUniqueName,
          },
          selectionSet: discussionChannelSelectionSet,
          options: {
            offset,
            limit,
            sort: {
              createdAt: "DESC",
            },
          },
        });
      } else if (sort === "top") {
        // if sort is "top", get the DiscussionChannels sorted by weightedVotesCount.
        // Treat a null weightedVotesCount as 0.
        const discussionChannelsResult = await session.run(
          getTopDiscussionChannelsQuery,
          {
            channelUniqueName,
            offset: parseInt(offset, 10),
            limit: parseInt(limit, 10),
          }
        );

        result = discussionChannelsResult.records.map((record) => {
          return record.get("DiscussionChannel");
        });
      } else {
        // By default, and if sort is "hot", get the DiscussionChannels sorted by hot,
        // which takes into account both weightedVotesCount and createdAt.
        const discussionChannelsResult = await session.run(
          getHotDiscussionChannelsQuery,
          {
            channelUniqueName,
            offset: parseInt(offset, 10),
            limit: parseInt(limit, 10),
          }
        );
        result = discussionChannelsResult.records.map((record) => {
          return record.get("DiscussionChannel");
        });

        console.log(
          "hot discussion channels result is ",
          discussionChannelsResult
        );
      }

      return result;
    } catch (error) {
      console.error("Error getting discussionChannels:", error);
      throw new Error(
        `Failed to fetch discussionChannels in channel. ${error.message}`
      );
    } finally {
      session.close();
    }
  };
};

module.exports = getResolver;
