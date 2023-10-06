const { getSiteWideDiscussionListQuery } = require("./cypherQueries");

const getResolver = ({ Event, driver }) => {
  return async (parent, args, context, info) => {
    const { searchInput, selectedChannels, selectedTags, options } = args;
    const { offset, limit, resultsOrder } = options || {};

    const session = driver.session();

    try {
      const result = await session.run(getSiteWideDiscussionListQuery, {
        searchInput,
        selectedChannels,
        selectedTags,
        offset,
        limit,
        resultsOrder,
      });

      const discussions = [];
      let aggregateDiscussionCount = 0;

      result.records.forEach((record) => {
        aggregateDiscussionCount = record.get("aggregateDiscussionCount");

        let author = null;
        if (record.get("Author") && record.get("Author").username !== null) {
          author = record.get("Author");
        }

        let discussionChannels = record.get("DiscussionChannels") || [];
        discussionChannels = discussionChannels.map((dc) => {
          if (dc.UpvotedByUsers) {
            dc.UpvotedByUsers = dc.UpvotedByUsers.map((username) => {
              return { username };
            });
          }
          return dc;
        });

        discussions.push({
          score: record.get("score"),
          discussion: {
            id: record.get("id"),
            title: record.get("title"),
            body: record.get("body"),
            Author: author,
            DiscussionChannels: discussionChannels,
            createdAt: record.get("createdAt"),
            updatedAt: record.get("updatedAt"),
            Tags: record.get("Tags").map((text) => ({ text })),
          },
        });
      });

      return {
        aggregateDiscussionCount,
        discussions,
      };
    } catch (error) {
      console.error("Error getting discussions:", error);
      throw new Error(`Failed to fetch discussions. ${error.message}`);
    } finally {
      session.close();
    }
  };
};

module.exports = getResolver;
