import { getDiscussionChannelsQuery } from "../cypher/cypherQueries.js";
import { timeFrameOptions } from "./utils.js";
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
              profilePicURL
              commentKarma
              createdAt
              discussionKarma
              ServerRoles {
                showAdminTag
              }
              ChannelRoles {
                showModTag
              }
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
  }
  `;
var timeFrameOptionKeys;
(function (timeFrameOptionKeys) {
    timeFrameOptionKeys["year"] = "year";
    timeFrameOptionKeys["month"] = "month";
    timeFrameOptionKeys["week"] = "week";
    timeFrameOptionKeys["day"] = "day";
})(timeFrameOptionKeys || (timeFrameOptionKeys = {}));
const getResolver = (input) => {
    const { driver, DiscussionChannel } = input;
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
            const aggregateCount = (aggregateDiscussionChannelsCountResult === null || aggregateDiscussionChannelsCountResult === void 0 ? void 0 : aggregateDiscussionChannelsCountResult.count) || 0;
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
                                // check if the related Tags contain any of the selectedTags
                                Tags_SOME: {
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
                        aggregateDiscussionChannelsCount: aggregateCount,
                    };
                case "top":
                    // if sort is "top", get the DiscussionChannels sorted by weightedVotesCount.
                    // Treat a null weightedVotesCount as 0.
                    let selectedTimeFrame = null;
                    if (timeFrameOptions[timeFrame]) {
                        selectedTimeFrame = timeFrameOptions[timeFrame].start;
                    }
                    const topDiscussionChannelsResult = await session.run(getDiscussionChannelsQuery, {
                        searchInput,
                        selectedTags: selectedTags || [],
                        channelUniqueName,
                        offset: parseInt(offset, 10),
                        limit: parseInt(limit, 10),
                        startOfTimeFrame: selectedTimeFrame,
                        sortOption: "top",
                    });
                    const topDiscussionChannels = topDiscussionChannelsResult.records.map((record) => {
                        return record.get("DiscussionChannel");
                    });
                    return {
                        discussionChannels: topDiscussionChannels,
                        aggregateDiscussionChannelsCount: aggregateCount,
                    };
                default:
                    // By default, and if sort is "hot", get the DiscussionChannels sorted by hot,
                    // which takes into account both weightedVotesCount and createdAt.
                    const hotDiscussionChannelsResult = await session.run(getDiscussionChannelsQuery, {
                        searchInput,
                        selectedTags: selectedTags || [],
                        channelUniqueName,
                        offset: parseInt(offset, 10),
                        limit: parseInt(limit, 10),
                        startOfTimeFrame: null,
                        sortOption: "hot",
                    });
                    const hotDiscussionChannels = hotDiscussionChannelsResult.records.map((record) => {
                        return record.get("DiscussionChannel");
                    });
                    return {
                        discussionChannels: hotDiscussionChannels,
                        aggregateDiscussionChannelsCount: aggregateCount,
                    };
            }
        }
        catch (error) {
            console.error("Error getting discussionChannels:", error);
            throw new Error(`Failed to fetch discussionChannels in channel. ${error.message}`);
        }
        finally {
            session.close();
        }
    };
};
export default getResolver;
