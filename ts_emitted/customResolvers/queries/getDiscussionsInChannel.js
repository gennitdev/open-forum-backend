import { getDiscussionChannelsQuery } from "../cypher/cypherQueries.js";
import { timeFrameOptions } from "./utils.js";
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
        var _a;
        const { channelUniqueName, options, selectedTags, searchInput } = args;
        const { offset, limit, sort, timeFrame } = options || {};
        const loggedInUsername = (_a = context.user) === null || _a === void 0 ? void 0 : _a.username;
        const session = driver.session();
        let titleRegex = `(?i).*${searchInput}.*`;
        let bodyRegex = `(?i).*${searchInput}.*`;
        try {
            let aggregateCount = 0;
            switch (sort) {
                case "new":
                    const newDiscussionChannelsResult = await session.run(getDiscussionChannelsQuery, {
                        searchInput,
                        titleRegex,
                        bodyRegex,
                        selectedTags: selectedTags || [],
                        channelUniqueName,
                        offset: parseInt(offset, 10),
                        limit: parseInt(limit, 10),
                        startOfTimeFrame: null,
                        sortOption: "new",
                        loggedInUsername
                    });
                    const newDiscussionChannels = newDiscussionChannelsResult.records.map((record) => {
                        return record.get("DiscussionChannel");
                    });
                    const firstResult = newDiscussionChannelsResult.records[0];
                    if (firstResult) {
                        aggregateCount = firstResult.get("totalCount");
                    }
                    return {
                        discussionChannels: newDiscussionChannels,
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
                        titleRegex,
                        bodyRegex,
                        selectedTags: selectedTags || [],
                        channelUniqueName,
                        offset: parseInt(offset, 10),
                        limit: parseInt(limit, 10),
                        startOfTimeFrame: selectedTimeFrame,
                        sortOption: "top",
                        loggedInUsername
                    });
                    const topDiscussionChannels = topDiscussionChannelsResult.records.map((record) => {
                        return record.get("DiscussionChannel");
                    });
                    const firstTopResult = topDiscussionChannelsResult.records[0];
                    if (firstTopResult) {
                        aggregateCount = firstTopResult.get("totalCount");
                    }
                    return {
                        discussionChannels: topDiscussionChannels,
                        aggregateDiscussionChannelsCount: aggregateCount,
                    };
                default:
                    // By default, and if sort is "hot", get the DiscussionChannels sorted by hot,
                    // which takes into account both weightedVotesCount and createdAt.
                    const hotDiscussionChannelsResult = await session.run(getDiscussionChannelsQuery, {
                        searchInput,
                        titleRegex,
                        bodyRegex,
                        selectedTags: selectedTags || [],
                        channelUniqueName,
                        offset: parseInt(offset, 10),
                        limit: parseInt(limit, 10),
                        startOfTimeFrame: null,
                        sortOption: "hot",
                        loggedInUsername
                    });
                    const hotDiscussionChannels = hotDiscussionChannelsResult.records.map((record) => {
                        return record.get("DiscussionChannel");
                    });
                    const firstHotResult = hotDiscussionChannelsResult.records[0];
                    if (firstHotResult) {
                        aggregateCount = firstHotResult.get("totalCount");
                    }
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
