const { 
  getNewSiteWideDiscussionsQuery,
  getTopSiteWideDiscussionsQuery,
  getHotSiteWideDiscussionsQuery,
 } = require("../cypher/cypherQueries");
const { timeFrameOptions } = require("./utils");

const getResolver = ({ driver }) => {
  return async (parent, args, context, info) => {
    const { 
      searchInput, 
      selectedChannels, 
      selectedTags, 
      options,
    } = args;
    const { offset, limit, resultsOrder, sort,
      timeFrame, } = options || {};

    const session = driver.session();

    try {

      switch(sort) {
        case "new":
          let result = await session.run(getNewSiteWideDiscussionsQuery, {
            searchInput,
            selectedChannels,
            selectedTags,
            offset,
            limit,
            resultsOrder,
          });
          if (result.records.length === 0) {
            return []
          }
          let aggregateDiscussionCount = result.records[0].get("aggregateDiscussionCount");

          const discussions = result.records.map((record) => {
            return record.get("discussion");
          });

          return {
            discussions,
            aggregateDiscussionCount,
          }
        case "top":
          // to do
          break;
        default:
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
