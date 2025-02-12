import { GraphQLError } from 'graphql'
import type {
  ChannelModel,
  IssueModel,
  IssueUpdateInput,
  IssueWhere,
  CommentModel,
  DiscussionModel,
  EventModel,
  ChannelUpdateInput,
  ModerationActionCreateInput,
  ChannelWhere,
  ModerationProfile,
  User
} from '../../../ogm_types.js'
import { setUserDataOnContext } from '../../../rules/permission/userDataHelperFunctions.js'
import { getModerationActionCreateInput } from '../reportComment.js'

type CreateSuspensionResolverOptions = {
  Issue: IssueModel
  Channel: ChannelModel
  Comment: CommentModel
  Discussion: DiscussionModel
  Event: EventModel

  // The name of the field on the Issue that identifies the user or mod to suspend
  issueRelatedAccountField: 'relatedUsername' | 'relatedModProfileName'

  // The field on Channel to connect the suspended user or mod
  channelSuspendedField: 'SuspendedUsers' | 'SuspendedMods'

  // A short string describing who/what is being suspended
  suspendedEntityName: 'user' | 'mod'

  // For constructing the moderation action message text (and description).
  suspensionActionDescription: string
  suspensionCommentText: string
}

type Args = {
  issueId: string
  suspendUntil: Date
  suspendIndefinitely: boolean
  explanation: string
}

export function createSuspensionResolver ({
  Issue,
  Channel,
  Discussion,
  Event,
  Comment,
  suspendedEntityName,
  suspensionActionDescription,
  suspensionCommentText
}: CreateSuspensionResolverOptions) {
  return async function suspendEntityResolver (
    parent: any,
    args: Args,
    context: any,
    resolveInfo: any
  ) {
    const { issueId, suspendUntil, suspendIndefinitely, explanation } = args
    if (!issueId) {
      throw new GraphQLError('Issue ID is required')
    }

    function isUser (data: User | ModerationProfile): data is User {
      return (data as User).username !== undefined
    }

    // Fetch Issue to ensure it exists and to retrieve the channel unique name.
    const issueData = await Issue.find({
      where: { id: issueId },
      selectionSet: `{
        id
        channelUniqueName
        relatedDiscussionId
        relatedEventId
        relatedCommentId
        Channel { uniqueName }
      }`
    })

    let originalPosterData: null | undefined | User | ModerationProfile = null
    const discussionId = issueData[0]?.relatedDiscussionId
    const eventId = issueData[0]?.relatedEventId
    const commentId = issueData[0]?.relatedCommentId

    if (discussionId) {
      const discussionResult = await Discussion.find({
        where: { id: discussionId },
        selectionSet: `{ 
          id
          Author { username } 
        }`
      })
      originalPosterData = discussionResult[0]?.Author
    }
    if (eventId) {
      const eventResult = await Event.find({
        where: { id: eventId },
        selectionSet: `{ 
          id
          Author { username } 
        }`
      })
      originalPosterData = eventResult[0]?.Poster
    }
    if (commentId) {
      const commentResult = await Comment.find({
        where: { id: commentId },
        selectionSet: `{ 
          id
          Author { username } 
        }`
      })
      originalPosterData = commentResult[0]?.CommentAuthor
    }

    if (issueData.length === 0) {
      throw new GraphQLError('Issue not found')
    }

    const foundIssue = issueData[0]
    const channelUniqueName = foundIssue?.Channel?.uniqueName
    if (!channelUniqueName) {
      throw new GraphQLError('Could not find the forum name for the issue.')
    }

    let relatedAccountName = ''
    let relatedAccountType = ''
    if (originalPosterData && !isUser(originalPosterData)) {
      if (!originalPosterData.displayName) {
        throw new GraphQLError(
          `Could not find the ${suspendedEntityName} account name to be suspended.`
        )
      }
      relatedAccountName = originalPosterData.displayName
      relatedAccountType = 'ModerationProfile'
    } else if ((originalPosterData as User)?.username) {
      relatedAccountName = (originalPosterData as User).username
      relatedAccountType = 'User'
      if (!relatedAccountName) {
        throw new GraphQLError(
          `Could not find the ${suspendedEntityName} account name to be suspended.`
        )
      }
    }
    if (!relatedAccountName) {
      throw new GraphQLError(
        `Could not find the ${suspendedEntityName} account name to be suspended.`
      )
    }

    //  Make sure the user is logged in and is a moderator
    context.user = await setUserDataOnContext({
      context,
      getPermissionInfo: false
    })
    const loggedInUsername = context.user?.username || null
    if (!loggedInUsername) {
      throw new GraphQLError('User must be logged in')
    }
    const loggedInModName = context.user.data?.ModerationProfile?.displayName
    if (!loggedInModName) {
      throw new GraphQLError(`User ${loggedInUsername} is not a moderator`)
    }

    const moderationActionCreateInput: ModerationActionCreateInput =
      getModerationActionCreateInput({
        text: suspensionCommentText,
        loggedInModName,
        channelUniqueName,
        actionType: 'suspension',
        actionDescription: suspensionActionDescription,
        issueId
      })

    // Update the Issue with the new ModerationAction
    const issueUpdateWhere: IssueWhere = { id: issueId }
    const issueUpdateInput: IssueUpdateInput = {
      ActivityFeed: [
        {
          create: [
            {
              node: moderationActionCreateInput
            }
          ]
        }
      ]
    }

    let updatedIssue: any
    try {
      updatedIssue = await Issue.update({
        where: issueUpdateWhere,
        update: issueUpdateInput
      })
    } catch (error) {
      throw new GraphQLError('Error updating issue')
    }

    const updatedIssueId = updatedIssue.issues[0]?.id || null
    if (!updatedIssueId) {
      throw new GraphQLError('Unable to update Issue with ModerationAction')
    }
    const channelUpdateWhere: ChannelWhere = {
      uniqueName: channelUniqueName
    }
    let channelUpdateInput: ChannelUpdateInput | null = null
    if (relatedAccountType === 'User') {
      channelUpdateInput = {
        SuspendedUsers: [
          {
            create: [
              {
                node: {
                  // Create Suspension, which contains the length
                  // of the suspension and the reason for it.
                  channelUniqueName: channelUniqueName,
                  username: relatedAccountName,
                  suspendedUntil: suspendUntil,
                  suspendedIndefinitely: suspendIndefinitely,
                  SuspendedUser: {
                    connect: {
                      where: {
                        node: {
                          username: relatedAccountName
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        ]
      }
    } else if (relatedAccountType === 'ModerationProfile') {
      channelUpdateInput = {
        SuspendedMods: [
          {
            create: [
              {
                // Create Suspension, which contains the length
                // of the suspension and the reason for it.
                node: {
                  channelUniqueName: channelUniqueName,
                  modProfileName: relatedAccountName,
                  suspendedUntil: suspendUntil,
                  suspendedIndefinitely: suspendIndefinitely,
                  SuspendedMod: {
                    connect: {
                      where: {
                        node: {
                          displayName: relatedAccountName
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        ]
      }

      try {
        const channelData = await Channel.update({
          where: channelUpdateWhere,
          update: channelUpdateInput
        })
        const channelId = channelData.channels[0]?.uniqueName || null
        if (channelId) {
          return updatedIssue // success
        }
      } catch (error) {
        throw new GraphQLError('Error updating channel')
      }

      return false
    }
  }
}
