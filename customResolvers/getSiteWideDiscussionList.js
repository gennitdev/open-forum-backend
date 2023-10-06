const { getSiteWideDiscussionListQuery } = require("./cypherQueries");

const getResolver = ({ Event, driver }) => {
  return async (parent, args, context, info) => {
    const { searchInput, selectedChannels, selectedTags } = args;

    const session = driver.session();

    try {
      const result = await session.run(getSiteWideDiscussionListQuery, {
        searchInput,
        selectedChannels,
        selectedTags
      });

      const discussions = result.records.map((record) => {
        let author = null;
        if (record.get("Author") && record.get("Author").username !== null) {
          author = record.get("Author");
        }

        let discussionChannels  = record.get("DiscussionChannels") || []
        discussionChannels = discussionChannels.map((dc) => {
          if (dc.UpvotedByUsers) {
            dc.UpvotedByUsers = dc.UpvotedByUsers.map((username) => {
              return { username };
            })
          }
          return dc;
        });

        return {
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
        };
      });

      return discussions;
    } catch (error) {
      console.error("Error getting discussions:", error);
      throw new Error(`Failed to fetch discussions. ${error.message}`);
    } finally {
      session.close();
    }
  };
};
module.exports = getResolver;
