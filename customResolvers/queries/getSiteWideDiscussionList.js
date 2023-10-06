const {
  getNewSiteWideDiscussionsQuery,
  getTopSiteWideDiscussionsQuery,
  getHotSiteWideDiscussionsQuery,
} = require("../cypher/cypherQueries");
const { timeFrameOptions } = require("./utils");

const getResolver = ({ driver }) => {
  return async (parent, args, context, info) => {
    const { searchInput, selectedChannels, selectedTags, options } = args;
    const { offset, limit, resultsOrder, sort, timeFrame } = options || {};

    const session = driver.session();

    try {
      switch (sort) {
        case "new":
          let newDiscussionResult = await session.run(
            getNewSiteWideDiscussionsQuery,
            {
              searchInput,
              selectedChannels,
              selectedTags,
              offset,
              limit,
              resultsOrder,
            }
          );
          if (newDiscussionResult.records.length === 0) {
            return [];
          }
          let aggregateNewDiscussionCount = newDiscussionResult.records[0].get(
            "aggregateDiscussionCount"
          );

          const newDiscussions = newDiscussionResult.records.map((record) => {
            return record.get("discussion");
          });

          return {
            discussions: newDiscussions,
            aggregateDiscussionCount: aggregateNewDiscussionCount,
          };
        case "top":
          // if sort is "top", get the Discussions sorted by the sum of the
          // weightedVotesCounts of the related DiscussionChannels.
          // Treat a null weightedVotesCount as 0.
          let selectedTimeFrame = null;

          if (timeFrameOptions[timeFrame]) {
            selectedTimeFrame = timeFrameOptions[timeFrame].start;
          }
          const topDiscussionsResult = await session.run(
            getTopSiteWideDiscussionsQuery,
            {
              searchInput,
              selectedChannels,
              selectedTags,
              offset,
              limit,
              resultsOrder,
            }
          );

          if (topDiscussionsResult.records.length === 0) {
            return [];
          }
          let aggregateDiscussionCount = topDiscussionsResult.records[0].get(
            "aggregateDiscussionCount"
          );

          const discussions = topDiscussionsResult.records.map((record) => {
            return record.get("discussion");
          });

          return {
            discussions,
            aggregateDiscussionCount,
          };
        default:
          // By default, and if sort is "hot", get the DiscussionChannels sorted by hot,
          // which takes into account both weightedVotesCount and createdAt.
          const hotDiscussionsResult = await session.run(
            getTopSiteWideDiscussionsQuery,
            {
              searchInput,
              selectedChannels,
              selectedTags,
              offset,
              limit,
              resultsOrder,
            }
          );

          if (hotDiscussionsResult.records.length === 0) {
            return [];
          }

          let aggregateHotDiscussionCount = hotDiscussionsResult.records[0].get(
            "aggregateDiscussionCount"
          );

          const hotDiscussions = hotDiscussionsResult.records.map((record) => {
            console.log('score is ',record.get("score"))
            return record.get("discussion");
          });

          return {
            discussions: hotDiscussions,
            aggregateDiscussionCount: aggregateHotDiscussionCount,
          };
      }
    } catch (error) {
      console.error("Error getting discussions:", error);
      throw new Error(`Failed to fetch discussions. ${error.message}`);
    } finally {
      session.close();
    }
  };
};

module.exports = getResolver;
