import type {
  IssueModel,
  CommentModel,
  DiscussionModel,
  EventModel,
  User,
  ModerationProfile,
  SuspensionModel
} from '../../ogm_types.js'

type Input = {
  Issue: IssueModel
  Comment: CommentModel
  Discussion: DiscussionModel
  Event: EventModel
  Suspension: SuspensionModel
}

export default function getResolver (input: Input) {
  const { Issue, Event, Comment, Discussion, Suspension } = input
  return async (parent: any, args: any, context: any, resolveInfo: any) => {
    const { issueId } = args
    if (!issueId) {
      throw new Error('All arguments (issueId) are required')
    }

    const issues = await Issue.find({
      where: {
        id: issueId
      },
      selectionSet: `
                id
                channelUniqueName
                relatedEventId
                relatedDiscussionId
                relatedCommentId
            `
    })

    if (!issues.length) {
      throw new Error(`Issue with ID ${issueId} not found`)
    }
    const issue = issues[0]

    let originalPoster: User | ModerationProfile | null | undefined = null

    if (issue.relatedEventId) {
      const events = await Event.find({
        where: {
          id: issue.relatedEventId
        },
        selectionSet: `
                    id
                    Poster {
                        username
                    }
                `
      })
      if (!events.length) {
        throw new Error(`Event with ID ${issue.relatedEventId} not found`)
      }
      const event = events[0]
      originalPoster = event.Poster
    }
    if (issue.relatedDiscussionId) {
      const discussions = await Discussion.find({
        where: {
          id: issue.relatedDiscussionId
        },
        selectionSet: `
                    id
                    Author {
                        username
                    }
                `
      })
      if (!discussions.length) {
        throw new Error(
          `Discussion with ID ${issue.relatedDiscussionId} not found`
        )
      }
      const discussion = discussions[0]
      originalPoster = discussion.Author
    }
    if (issue.relatedCommentId) {
      const comments = await Comment.find({
        where: {
          id: issue.relatedCommentId
        },
        selectionSet: `
                    id
                    CommentAuthor {
                        ... on User {
                            username
                        }
                        ... on ModerationProfile {
                            displayName
                        }
                    }
                `
      })
      if (!comments.length) {
        throw new Error(`Comment with ID ${issue.relatedCommentId} not found`)
      }
      const comment = comments[0]
      originalPoster = comment.CommentAuthor
    }
    if (!originalPoster) {
      throw new Error('Original poster not found')
    }
    // Check for suspension with the original author username
    // and the given channel
    if ('username' in originalPoster) {
      const suspensions = await Suspension.find({
        where: {
          username: originalPoster.username,
          channelUniqueName: issue.Channel?.uniqueName
        }
      })
      if (!suspensions.length) {
        return false
      }
      return true
    }
    if ('displayName' in originalPoster) {
      const suspensions = await Suspension.find({
        where: {
          modProfileName: originalPoster.displayName,
          channelUniqueName: issue.Channel?.uniqueName
        }
      })
      if (!suspensions.length) {
        return false
      }
      return true
    }
  }
}
