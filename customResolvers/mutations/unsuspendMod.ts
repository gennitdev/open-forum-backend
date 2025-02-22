import type {
  IssueModel,
  ChannelModel,
  EventModel,
  DiscussionModel,
  CommentModel
} from '../../ogm_types.js'
import { createUnsuspendResolver } from './shared/createUnsuspendResolver.js'

type Input = {
  Issue: IssueModel
  Channel: ChannelModel
  Event: EventModel
  Comment: CommentModel
  Discussion: DiscussionModel
}

export default function getResolver (input: Input) {
  const { Issue, Channel, Event, Comment, Discussion } = input
  return createUnsuspendResolver({
    Issue,
    Channel,
    Comment,
    Discussion,
    Event,
    issueRelatedAccountField: 'relatedModProfileName',
    channelSuspendedField: 'SuspendedMods',
    suspendedEntityName: 'mod',
    unsuspendCommentText: 'The mod has been suspended.'
  })
}
