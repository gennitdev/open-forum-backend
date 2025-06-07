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
  console.log('=== DEBUG: Hook processing comment on discussion')
  console.log('=== DEBUG: Hook discussion details:', {
    discussionId: fullComment.DiscussionChannel?.discussionId,
    channelName: fullComment.Channel?.uniqueName,
    commenterUsername
  })

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
    console.log('=== DEBUG: Not notifying author of their own comment:', authorUsername)
    return
  }
  
  console.log('=== DEBUG: Will notify discussion author:', authorUsername)

  const channelName = fullComment.Channel?.uniqueName
  console.log('=== DEBUG: Hook sending notification details:', {
    recipient: authorUsername,
    discussionTitle: discussion.title,
    channelName,
    commentId
  })

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

  console.log('=== DEBUG: Hook calling sendEmailToUser for discussion notification')
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
  console.log('=== DEBUG: Hook sendEmailToUser completed for discussion notification')
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
 * Comment notification hook that runs after comment creation
 */
export const commentNotificationHandler = async ({ context, result }: any) => {
  try {
    console.log('=== DEBUG: Comment notification hook running...')
    console.log('=== DEBUG: Hook result structure:', {
      hasResult: !!result,
      hasComments: !!result?.comments,
      commentsLength: result?.comments?.length || 0,
      firstCommentId: result?.comments?.[0]?.id
    })
    
    // Make sure we have comment data and an ID
    if (!result?.comments?.[0]?.id) {
      console.log('=== DEBUG WARNING: No comment found in hook result')
      return
    }
    
    // Get the newly created comment ID
    const commentId = result.comments[0].id
    console.log('=== DEBUG: Processing hook notification for comment:', commentId)
    
    // Access OGM models
    const { ogm } = context
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
      console.error('=== DEBUG ERROR: Could not find comment details in hook')
      return
    }
    
    const fullComment = fullComments[0] as Comment
    console.log('=== DEBUG: Found comment details in hook for ID:', commentId)
    console.log('=== DEBUG: Hook comment structure:', {
      hasDiscussionChannel: !!fullComment.DiscussionChannel,
      hasEvent: !!fullComment.Event,
      hasParentComment: !!fullComment.ParentComment,
      channelName: fullComment.Channel?.uniqueName
    })
    
    // Process the notification based on comment type
    await processCommentNotification(
      fullComment,
      commentId,
      CommentModel,
      UserModel,
      DiscussionModel
    )
  } catch (error) {
    console.error('=== DEBUG ERROR: Error in comment notification hook:', error)
    // Don't re-throw the error, so we don't affect the mutation
  }
}