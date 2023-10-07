const { getDiscussionChannelsQuery } = require("../cypher/cypherQueries");
const { timeFrameOptions } = require("./utils");

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
          Tags {
            text
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
    const { channelUniqueName, options, selectedTags, searchInput } = args;
    const { offset, limit, sort, timeFrame } = options || {};

    const session = driver.session();

    try {
      let result = [];

      switch (sort) {
        case "new":
          const filters = [
            {
              channelUniqueName,
            },
          ];

          if (searchInput) {
            filters.push({
              OR: [
                {
                  Discussion: {
                    body_CONTAINS: searchInput,
                  },
                },
                {
                  Discussion: {
                    title_CONTAINS: searchInput,
                  },
                },
              ],
            });
          }

          if (selectedTags && selectedTags.length > 0) {
            filters.push({
              Discussion: {
                Tags: {
                  text_IN: selectedTags,
                },
              },
            });
          }
          // if sort is "new", get the DiscussionChannels sorted by createdAt.
          result = await DiscussionChannel.find({
            where: {
              AND: filters,
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

          const aggregate = await DiscussionChannel.aggregate({
            where: {
              AND: filters,
            },
            aggregate: {
              count: true,
            },
          });

          if (result.length === 0) {
            return {
              discussionChannels: [],
              aggregateDiscussionChannelsCount: 0,
            };
          }

          return {
            discussionChannels: result,
            aggregateDiscussionChannelsCount: aggregate?.count || 0,
          };

        case "top":
          // if sort is "top", get the DiscussionChannels sorted by weightedVotesCount.
          // Treat a null weightedVotesCount as 0.

          let selectedTimeFrame = null;

          if (timeFrameOptions[timeFrame]) {
            selectedTimeFrame = timeFrameOptions[timeFrame].start;
          }
          const topDiscussionChannelsResult = await session.run(
            getDiscussionChannelsQuery,
            {
              searchInput,
              selectedTags: selectedTags || [],
              channelUniqueName,
              offset: parseInt(offset, 10),
              limit: parseInt(limit, 10),
              startOfTimeFrame: selectedTimeFrame,
              sortOption: "top",
            }
          );

          if (topDiscussionChannelsResult.records.length === 0) {
            return {
              discussionChannels: [],
              aggregateDiscussionChannelCount: 0,
            };
          }
          let aggregateTopDiscussionChannelCount =
            topDiscussionChannelsResult.records[0].get(
              "aggregateDiscussionChannelCount"
            );

          const topDiscussionChannels = topDiscussionChannelsResult.records.map(
            (record) => {
              return record.get("DiscussionChannel");
            }
          );

          return {
            discussionChannels: topDiscussionChannels,
            aggregateDiscussionChannelsCount:
              aggregateTopDiscussionChannelCount || 0,
          };
        default:
          // By default, and if sort is "hot", get the DiscussionChannels sorted by hot,
          // which takes into account both weightedVotesCount and createdAt.
          const hotDiscussionChannelsResult = await session.run(
            getDiscussionChannelsQuery,
            {
              searchInput,
              selectedTags: selectedTags || [],
              channelUniqueName,
              offset: parseInt(offset, 10),
              limit: parseInt(limit, 10),
              startOfTimeFrame: null,
              sortOption: "hot",
            }
          );

          if (hotDiscussionChannelsResult.records.length === 0) {
            return {
              discussionChannels: [],
              aggregateDiscussionChannelsCount: 0,
            };
          }

          let aggregateHotDiscussionChannelsCount =
            hotDiscussionChannelsResult.records[0].get(
              "aggregateDiscussionChannelCount"
            );

          const hotDiscussionChannels = hotDiscussionChannelsResult.records.map(
            (record) => {
              return record.get("DiscussionChannel");
            }
          );

          return {
            discussionChannels: hotDiscussionChannels,
            aggregateDiscussionChannelsCount:
              aggregateHotDiscussionChannelsCount || 0,
          };
      }
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
