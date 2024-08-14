import { getSiteWideDiscussionsQuery } from "../cypher/cypherQueries.js";
import { timeFrameOptions } from "./utils.js";

type Input = {
  Discussion: any;
  driver: any;
};

enum timeFrameOptionKeys {
  year = "year",
  month = "month",
  week = "week",
  day = "day",
}

type Args = {
  searchInput: string;
  selectedChannels: string[];
  selectedTags: string[];
  options: {
    offset: string;
    limit: string;
    resultsOrder: string;
    sort: string;
    timeFrame: timeFrameOptionKeys;
  };
};

const getResolver = (input: Input) => {
  const { driver, Discussion } = input;

  return async (parent: any, args: Args, context: any, info: any) => {
    const { searchInput, selectedChannels, selectedTags, options } = args;
    const { offset, limit, resultsOrder, sort, timeFrame } = options || {};

    const session = driver.session();
    let titleRegex = `(?i).*${searchInput}.*`;
    let bodyRegex = `(?i).*${searchInput}.*`;

    try {
      switch (sort) {
        case "new":
          let newDiscussionResult = await session.run(
            getSiteWideDiscussionsQuery,
            {
              searchInput,
              titleRegex,
              bodyRegex,
              selectedChannels,
              selectedTags,
              offset,
              limit,
              resultsOrder,
              startOfTimeFrame: null,
              sortOption: "new",
            }
          );

          // For each record, do record.get("discussion") to get the discussions
          let newRecord = newDiscussionResult.records[0]; // Assuming there's only one result row
          let totalCount = newRecord.get("totalCount") || 0;
          let discussions = newDiscussionResult.records.map((record: any) => {
            return record.get("discussion")
          })

          return {
            discussions,
            aggregateDiscussionCount: totalCount,
          };

        case "top":
          // if sort is "top", get the Discussions sorted by the sum of the
          // weightedVotesCounts of the related DiscussionChannels.
          // Treat a null weightedVotesCount as 0.
          let selectedTimeFrame = timeFrameOptions.year.start;

          if (timeFrameOptions[timeFrame]) {
            selectedTimeFrame = timeFrameOptions[timeFrame].start;
          }

          let topDiscussionsResult = await session.run(
            getSiteWideDiscussionsQuery,
            {
              searchInput,
              titleRegex,
              bodyRegex,
              selectedChannels,
              selectedTags,
              offset,
              limit,
              resultsOrder,
              startOfTimeFrame: selectedTimeFrame,
              sortOption: "top",
            }
          );

          // Extract the total count and the discussions from the query result
          let topRecord = topDiscussionsResult.records[0]; // Assuming there's only one result row
          let topTotalCount = topRecord.get("totalCount");
          let topDiscussions = topDiscussionsResult.records.map((record: any) => {
            return record.get("discussion")
          })

          return {
            discussions: topDiscussions,
            aggregateDiscussionCount: topTotalCount,
          };

        default:
          // By default, and if sort is "hot", get the DiscussionChannels sorted by hot,
          // which takes into account both weightedVotesCount and createdAt.
          let hotDiscussionsResult = await session.run(
            getSiteWideDiscussionsQuery,
            {
              searchInput,
              titleRegex,
              bodyRegex,
              selectedChannels,
              selectedTags,
              offset,
              limit,
              resultsOrder,
              startOfTimeFrame: null,
              sortOption: "hot",
            }
          );

          // Extract the total count and the discussions from the query result
          let hotRecord = hotDiscussionsResult.records[0]; // Assuming there's only one result row
          let hotTotalCount = hotRecord.get("totalCount");
          let hotDiscussions = hotDiscussionsResult.records.map((record: any) => {
            return record.get("discussion")
          })

          return {
            discussions: hotDiscussions,
            aggregateDiscussionCount: hotTotalCount,
          };
      }
    } catch (error: any) {
      console.error("Error getting discussions:", error);
      throw new Error(`Failed to fetch discussions. ${error.message}`);
    } finally {
      session.close();
    }
  };
};

export default getResolver;
