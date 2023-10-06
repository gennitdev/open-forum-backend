const {
  getTopDiscussionChannelsQuery,
  getHotDiscussionChannelsQuery,
} = require("../cypher/cypherQueries");
const luxon = require("luxon");


const timeFrameOptions = {
  // Conversion to UTC is required for the time comparison
  // to be in a consistent timezone.
  day: {
    start: luxon.DateTime.local().minus({ days: 1 }).toUTC().toISO(),
  },
  week: {
    start: luxon.DateTime.local().minus({ weeks: 1 }).toUTC().toISO(),
  },
  month: {
    start: luxon.DateTime.local().minus({ months: 1 }).toUTC().toISO(),
  },
  year: {
    start: luxon.DateTime.local().minus({ years: 1 }).toUTC().toISO(),
  },
}

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
    const { channelUniqueName, offset, limit, sort, timeFrame } = args;

    const session = driver.session();

    try {
      let result = [];

      switch (sort) {
        case "new":
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
          break;
        case "top":
          // if sort is "top", get the DiscussionChannels sorted by weightedVotesCount.
          // Treat a null weightedVotesCount as 0.

          let selectedTimeFrame = null;

          if (timeFrameOptions[timeFrame]) {
            selectedTimeFrame = timeFrameOptions[timeFrame].start;
          }
          console.log('variables in session ',{
            channelUniqueName,
            offset: parseInt(offset, 10),
            limit: parseInt(limit, 10),
            startOfTimeFrame: selectedTimeFrame,
          })
          const topDiscussionChannelsResult = await session.run(
            getTopDiscussionChannelsQuery,
            {
              channelUniqueName,
              offset: parseInt(offset, 10),
              limit: parseInt(limit, 10),
              startOfTimeFrame: selectedTimeFrame,
            }
          );

          result = topDiscussionChannelsResult.records.map((record) => {
            return record.get("DiscussionChannel");
          });
          break;
        default:
          // By default, and if sort is "hot", get the DiscussionChannels sorted by hot,
          // which takes into account both weightedVotesCount and createdAt.
          const hotDiscussionChannelsResult = await session.run(
            getHotDiscussionChannelsQuery,
            {
              channelUniqueName,
              offset: parseInt(offset, 10),
              limit: parseInt(limit, 10),
            }
          );
          result = hotDiscussionChannelsResult.records.map((record) => {
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
