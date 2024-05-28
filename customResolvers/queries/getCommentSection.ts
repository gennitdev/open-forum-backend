import {
  getCommentsQuery,
  getNewCommentsQuery,
} from "../cypher/cypherQueries.js";

const discussionChannelSelectionSet = `
{
    id
    createdAt
    weightedVotesCount
    discussionId
    channelUniqueName
    emoji
    Channel {
        uniqueName
    }
    Discussion {
        id
        title
        Author {
            username
            displayName
            profilePicURL
            commentKarma
            createdAt
            discussionKarma
            ... on User {
                ServerRoles {
                  showAdminTag
                }
              }
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

type Input = {
  driver: any;
  DiscussionChannel: any;
  Comment: any;
};

type Args = {
  channelUniqueName: string;
  discussionId: string;
  modName: string;
  offset: string;
  limit: string;
  sort: string;
};

const getResolver = (input: Input) => {
  const { driver, DiscussionChannel, Comment } = input;
  return async (parent: any, args: Args, context: any, info: any) => {
    const { channelUniqueName, discussionId, modName, offset, limit, sort } =
      args;

    const session = driver.session();

    try {
      const result = await DiscussionChannel.find({
        where: {
          discussionId,
          channelUniqueName,
        },
        // get everything about the DiscussionChannel
        // except the comments
        selectionSet: discussionChannelSelectionSet,
      });

      if (result.length === 0) {
        throw new Error("DiscussionChannel not found");
      }

      const discussionChannel = result[0];
      const discussionChannelId = discussionChannel.id;

      let commentsResult = [];

      if (sort === "new") {
        // if sort is "new", get the comments sorted by createdAt.
        commentsResult = await session.run(getNewCommentsQuery, {
          discussionChannelId,
          modName,
          offset: parseInt(offset, 10),
          limit: parseInt(limit, 10),
        });

        commentsResult = commentsResult.records.map((record: any) => {
          return record.get("comment");
        });
      } else if (sort === "top") {
        // if sort is "top", get the comments sorted by weightedVotesCount.
        // Treat a null weightedVotesCount as 0.
        commentsResult = await session.run(getCommentsQuery, {
          discussionChannelId,
          modName,
          offset: parseInt(offset, 10),
          limit: parseInt(limit, 10),
          sortOption: "top",
        });

        commentsResult = commentsResult.records.map((record: any) => {
          return record.get("comment");
        });
      } else {
        // if sort is "hot", get the comments sorted by hotness,
        // which takes into account both weightedVotesCount and createdAt.
        commentsResult = await session.run(getCommentsQuery, {
          discussionChannelId,
          modName,
          offset: parseInt(offset, 10),
          limit: parseInt(limit, 10),
          sortOption: "hot",
        });

        commentsResult = commentsResult.records.map((record: any) => {
          return record.get("comment");
        });
      }

      return {
        DiscussionChannel: discussionChannel,
        Comments: commentsResult,
      };
    } catch (error: any) {
      console.error("Error getting comment section:", error);
      throw new Error(`Failed to fetch comment section. ${error.message}`);
    } finally {
      session.close();
    }
  };
};

export default getResolver;
