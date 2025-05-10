import { ApolloServerPlugin } from 'apollo-server-plugin-base'
import {
  GraphQLServiceContext,
  GraphQLRequestContext
} from 'apollo-server-types'
import {
  sendEmailToUser,
  createCommentNotificationEmail
} from '../customResolvers/mutations/shared/emailUtils.js'

// Type definitions for better type safety
type CommentAuthor = {
  __typename: string;
  username?: string;
  displayName?: string;
}

type Comment = {
  id: string;
  text: string;
  Channel?: {
    uniqueName: string;
  };
  CommentAuthor: CommentAuthor;
  DiscussionChannel?: {
    id: string;
    discussionId: string;
    Channel: {
      uniqueName: string;
      displayName?: string;
    };
  };
  Event?: {
    id: string;
    title: string;
    Poster: {
      username: string;
    };
    EventChannels: {
      channelUniqueName?: string;
      Channel: {
        uniqueName: string;
      };
    }[];
  };
  ParentComment?: {
    id: string;
    CommentAuthor: CommentAuthor;
  };
}

type ParentCommentDetails = {
  id: string;
  Channel?: {
    uniqueName: string;
  };
  CommentAuthor: CommentAuthor;
  DiscussionChannel?: {
    discussionId: string;
    Channel: {
      uniqueName: string;
    };
    Discussion: {
      id: string;
      title: string;
    };
  };
  Event?: {
    id: string;
    title: string;
    EventChannels: {
      Channel: {
        uniqueName: string;
      };
    }[];
  };
}

/**
 * Process notification for a comment on a discussion
 */
async function processDiscussionCommentNotification(
  fullComment: Comment,
  commentId: string,
  commenterUsername: string,
  DiscussionModel: any,
  UserModel: any
) {
  console.log('Processing comment on discussion')

  // We need to get the discussion details
  const discussionId = fullComment.DiscussionChannel?.discussionId

  // Fetch the discussion and its author
  const discussions = await DiscussionModel.find({
    where: { id: discussionId },
    selectionSet: `{
      id
      title
      Author {
        username
      }
    }`
  })

  if (!discussions.length || !discussions[0].Author) {
    console.log('Discussion or author not found')
    return
  }

  const discussion = discussions[0]
  const authorUsername = discussion.Author.username

  // Don't notify authors about their own comments
  if (commenterUsername === authorUsername) {
    console.log('Not notifying author of their own comment')
    return
  }

  const channelName = fullComment.Channel?.uniqueName
  console.log(
    `Sending notification to ${authorUsername} about comment on discussion ${discussion.title}`
  )

  // Create markdown notification text for in-app notification
  const notificationMessage = `
${commenterUsername} commented on your discussion [${discussion.title}](${process.env.FRONTEND_URL}/forums/${channelName}/discussions/${discussion.id}/comments/${commentId})
`

  // Create email content
  const emailContent = createCommentNotificationEmail(
    fullComment.text,
    discussion.title,
    commenterUsername,
    channelName || '',
    discussion.id,
    commentId
  )

  // Send both email and in-app notification
  await sendEmailToUser(
    authorUsername,
    emailContent,
    UserModel,
    {
      inAppText: notificationMessage,
      createInAppNotification: true
    }
  )
}

/**
 * Process notification for a comment on an event
 */
async function processEventCommentNotification(
  fullComment: Comment,
  commentId: string,
  commenterUsername: string,
  UserModel: any
) {
  console.log('Processing comment on event')

  const event = fullComment.Event
  if (!event) {
    console.log('Event not found')
    return
  }

  if (!event.Poster) {
    console.log('Event poster not found')
    return
  }

  const posterUsername = event.Poster.username

  // Don't notify posters about their own comments
  if (commenterUsername === posterUsername) {
    console.log('Not notifying poster of their own comment')
    return
  }

  // Get channel name from event channels (use first one for notification)
  if (!event.EventChannels || !event.EventChannels.length) {
    console.log('No channel found for event')
    return
  }

  const channelName = fullComment.Channel?.uniqueName
  console.log(
    `Sending notification to ${posterUsername} about comment on event ${event.title}`
  )

  // Create markdown notification text for in-app notification
  const notificationMessage = `
${commenterUsername} commented on your event [${event.title}](${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}/comments/${commentId})
`

  // Create email content for event notification
  const emailContent = {
    subject: `New comment on your event: ${event.title}`,
    plainText: `
${commenterUsername} commented on your event "${event.title}":

"${fullComment.text}"

View the comment at:
${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}/comments/${commentId}
`,
    html: `
<p><strong>${commenterUsername}</strong> commented on your event "<strong>${event.title}</strong>":</p>
<blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin-left: 0;">
  ${fullComment.text}
</blockquote>
<p>
  <a href="${process.env.FRONTEND_URL}/forums/${channelName}/events/${event.id}/comments/${commentId}">View the comment</a>
</p>
`
  }

  // Send both email and in-app notification
  await sendEmailToUser(
    posterUsername,
    emailContent,
    UserModel,
    {
      inAppText: notificationMessage,
      createInAppNotification: true
    }
  )
}

/**
 * Process notification for a reply to a comment
 */
async function processCommentReplyNotification(
  fullComment: Comment,
  commentId: string,
  commenterUsername: string,
  CommentModel: any,
  UserModel: any
) {
  console.log('Processing reply to comment')

  const parentComment = fullComment.ParentComment
  if (!parentComment) {
    console.log('Parent comment not found')
    return
  }

  if (!parentComment.CommentAuthor) {
    console.log('Parent comment author not found')
    return
  }

  // Fetch more details about the parent comment
  const parentCommentId = parentComment.id
  const parentCommentDetails = await CommentModel.find({
    where: { id: parentCommentId },
    selectionSet: `{
      id
      Channel {
        uniqueName
      }
      CommentAuthor {
        ... on User {
          __typename
          username
        }
        ... on ModerationProfile {
          __typename
          displayName
        }
      }
      DiscussionChannel {
        discussionId
        Channel {
          uniqueName
        }
        Discussion {
          id
          title
        }
      }
      Event {
        id
        title
        EventChannels {
          Channel {
            uniqueName
          }
        }
      }
    }`
  })

  if (!parentCommentDetails.length) {
    console.log('Could not fetch parent comment details')
    return
  }

  const parentCommentWithDetails = parentCommentDetails[0] as ParentCommentDetails

  // Determine parent comment author's username and if it's a user
  const isParentUserComment = parentCommentWithDetails.CommentAuthor.__typename === 'User'
  const parentAuthorUsername = isParentUserComment
    ? (parentCommentWithDetails.CommentAuthor as { username: string }).username
    : (parentCommentWithDetails.CommentAuthor as { displayName: string }).displayName

  // Don't notify authors about their own replies
  if (commenterUsername === parentAuthorUsername) {
    console.log('Not notifying author of reply to their own comment')
    return
  }

  console.log(`Sending notification to ${parentAuthorUsername} about reply to their comment`)

  // Variable to store notification info
  let contentTitle, contentUrl, channelName

  // Determine if parent comment is on a discussion or event
  if (parentCommentWithDetails.DiscussionChannel) {
    contentTitle = parentCommentWithDetails.DiscussionChannel.Discussion.title
    channelName = parentCommentWithDetails.Channel?.uniqueName
    contentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/discussions/${parentCommentWithDetails.DiscussionChannel.Discussion.id}/comments/${parentCommentId}`
  } else if (parentCommentWithDetails.Event) {
    contentTitle = parentCommentWithDetails.Event.title

    // Get the channel name from the first event channel
    if (!parentCommentWithDetails.Channel?.uniqueName) {
      console.log('No channel found for event')
      return
    }

    channelName = parentCommentWithDetails.Channel?.uniqueName
    contentUrl = `${process.env.FRONTEND_URL}/forums/${channelName}/events/${parentCommentWithDetails.Event.id}/comments/${parentCommentId}`
  } else {
    console.log('No content reference found for parent comment')
    return
  }

  // Create markdown notification text for in-app notification
  const notificationMessage = `
${commenterUsername} replied to your comment on [${contentTitle}](${contentUrl})
`

  // Create email content for reply notification
  const emailContent = {
    subject: `New reply to your comment on: ${contentTitle}`,
    plainText: `
${commenterUsername} replied to your comment on "${contentTitle}":

"${fullComment.text}"

View the reply at:
${contentUrl}
`,
    html: `
<p><strong>${commenterUsername}</strong> replied to your comment on "<strong>${contentTitle}</strong>":</p>
<blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin-left: 0;">
  ${fullComment.text}
</blockquote>
<p>
  <a href="${contentUrl}">View the reply</a>
</p>
`
  }

  // Send both email and in-app notification
  if (isParentUserComment) {
    await sendEmailToUser(
      parentAuthorUsername,
      emailContent,
      UserModel,
      {
        inAppText: notificationMessage,
        createInAppNotification: true
      }
    )
  }
}

/**
 * Process comment notification based on comment type
 */
async function processCommentNotification(
  fullComment: Comment,
  commentId: string,
  CommentModel: any,
  UserModel: any,
  DiscussionModel: any
) {
  // Get the commenter info
  const commenterUsername =
    fullComment.CommentAuthor?.username ||
    fullComment.CommentAuthor?.displayName ||
    'Someone'

  // DISCUSSION COMMENT NOTIFICATION
  if (fullComment.DiscussionChannel) {
    await processDiscussionCommentNotification(
      fullComment,
      commentId,
      commenterUsername,
      DiscussionModel,
      UserModel
    )
  }
  // EVENT COMMENT NOTIFICATION
  else if (fullComment.Event) {
    await processEventCommentNotification(
      fullComment,
      commentId,
      commenterUsername,
      UserModel
    )
  }
  // COMMENT REPLY NOTIFICATION
  else if (fullComment.ParentComment) {
    await processCommentReplyNotification(
      fullComment,
      commentId,
      commenterUsername,
      CommentModel,
      UserModel
    )
  }
}

/**
 * Apollo Server plugin that handles comment notifications
 * This runs after GraphQL operations complete but before the response is sent
 */
export const commentNotificationPlugin: ApolloServerPlugin = {
  async serverWillStart(service: GraphQLServiceContext): Promise<any> {
    console.log('Comment notification plugin initialized')
    return {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext: GraphQLRequestContext<any>) {
            console.log('PLUGIN: Operation resolved')
            console.log('PLUGIN: Operation type:', requestContext.operation?.operation)
            console.log('PLUGIN: Operation name:', requestContext.request.operationName)
          },
          
          async willSendResponse(requestContext: GraphQLRequestContext<any>) {
            console.log('PLUGIN: Will send response')
            
            try {
              // Only proceed if we have a successful createComments mutation
              if (
                requestContext.operation?.operation === 'mutation' &&
                requestContext.response?.data?.createComments?.comments?.[0]?.id
              ) {
                console.log('Processing comment notification for newly created comment')
                
                // Get the newly created comment from the response
                const newComment = requestContext.response.data.createComments.comments[0]
                const commentId = newComment.id
                
                if (!commentId) {
                  console.log('No comment ID found in response')
                  return
                }
                
                // Access the OGM models from context
                const { ogm } = requestContext.context
                const CommentModel = ogm.model('Comment')
                const UserModel = ogm.model('User')
                const DiscussionModel = ogm.model('Discussion')
                
                // Fetch the full comment details with all the relationships we need
                const fullComments = await CommentModel.find({
                  where: { id: commentId },
                  selectionSet: `{
                    id
                    text
                    Channel {
                      uniqueName
                    }
                    CommentAuthor {
                      ... on User {
                        __typename
                        username
                      }
                      ... on ModerationProfile {
                        __typename
                        displayName
                      }
                    }
                    DiscussionChannel {
                      id
                      discussionId
                      Channel {
                        uniqueName
                        displayName
                      }
                    }
                    Event {
                      id
                      title
                      Poster {
                        username
                      }
                      EventChannels {
                        channelUniqueName
                        Channel {
                          uniqueName
                        }
                      }
                    }
                    ParentComment {
                      id
                      CommentAuthor {
                        ... on User {
                          __typename
                          username
                        }
                        ... on ModerationProfile {
                          __typename
                          displayName
                        }
                      }
                    }
                  }`
                })
                
                if (!fullComments || !fullComments.length) {
                  console.log('Could not find comment details')
                  return
                }
                
                const fullComment = fullComments[0] as Comment
                console.log('Found comment details for ID:', commentId)
                
                // Process the notification based on comment type
                await processCommentNotification(
                  fullComment,
                  commentId,
                  CommentModel,
                  UserModel,
                  DiscussionModel
                )
              }
            } catch (error) {
              console.error('Error in comment notification plugin:', error)
              // Don't re-throw the error, so we don't affect the response
            }
          }
        }
      }
    }
  }
}