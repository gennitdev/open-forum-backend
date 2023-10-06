
  
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
          Author {
              username
              commentKarma
              createdAt
              discussionKarma
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
  `

  const getResolver = ({ driver, DiscussionChannel }) => {
    return async (parent, args, context, info) => {
      const { channelUniqueName, offset, limit, sort } = args;
  
      const session = driver.session();

  
      try {
        let result = []
   
  
        if (sort === "new") {
          // if sort is "new", get the DiscussionChannels sorted by createdAt.
          commentsResult = await DiscussionChannel.find({
            where: {
                channelUniqueName,
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

           result = commentsResult
        } 
  
        return result;
      } catch (error) {
        console.error("Error getting discussions:", error);
        throw new Error(`Failed to fetch discussions in channel. ${error.message}`);
      } finally {
        session.close();
      }
    };
  };
  
  module.exports = getResolver;