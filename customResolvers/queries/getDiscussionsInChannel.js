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
          displayName
      }
      Discussion {
          id
          title
          body
          createdAt
          updatedAt
          Author {
              username
              displayName
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
      const filters = [
        {
          channelUniqueName,
        },
      ];
      const aggregateDiscussionChannelsCountResult = await DiscussionChannel.aggregate({
        where: {
          AND: filters,
        },
        aggregate: {
          count: true,
        },
      });

      const aggregateCount = aggregateDiscussionChannelsCountResult?.count || 0;

      if (aggregateCount === 0) {
        return {
          discussionChannels: [],
          aggregateDiscussionChannelsCount: 0,
        };
      }

      let result = [];

      switch (sort) {
        case "new":
        

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

          return {
            discussionChannels: result,
            aggregateDiscussionChannelsCount: aggregateCount
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

          const topDiscussionChannels = topDiscussionChannelsResult.records.map(
            (record) => {
              return record.get("DiscussionChannel");
            }
          );

          return {
            discussionChannels: topDiscussionChannels,
            aggregateDiscussionChannelsCount: aggregateCount
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

          const hotDiscussionChannels = hotDiscussionChannelsResult.records.map(
            (record) => {
              return record.get("DiscussionChannel");
            }
          );

          return {
            discussionChannels: hotDiscussionChannels,
            aggregateDiscussionChannelsCount: aggregateCount
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
