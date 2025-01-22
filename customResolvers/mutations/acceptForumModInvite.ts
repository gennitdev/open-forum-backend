import type { ChannelUpdateInput, ChannelModel, UserModel } from "../../ts_emitted/ogm-types";

type Args = {
  inviteeUsername: string;
  channelUniqueName: string;
};

type Input = {
  Channel: ChannelModel;
  User: UserModel;
};

const getResolver = (input: Input) => {
  const { Channel, User } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { channelUniqueName, inviteeUsername } = args;

    if (!channelUniqueName || !inviteeUsername) {
      throw new Error(
        "All arguments (channelUniqueName, inviteeUsername) are required"
      );
    }

    // Look up the mod profile of the user with the given username
    const userData = await User.find({
      where: {
        username: channelUniqueName,
      },
      selectionSet: `{
        ModerationProfile {
          displayName
        }
      }`
    });

    const modProfile = userData[0]?.ModerationProfile || null;
    if (!modProfile) {
      throw new Error(`User ${inviteeUsername} is not a moderator`);
    }

    const channelUpdateInput: ChannelUpdateInput = {
      Moderators: [
        {
          connect: [
            {
              where: {
                node: {
                  displayName: modProfile.displayName,
                },
              },
            },
          ],
        },
      ],
    };

    try {
      const result = await Channel.update({
        where: {
          uniqueName: channelUniqueName,
        },
        update: channelUpdateInput,
      });
      if (!result.channels[0]) {
        throw new Error("Channel not found");
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };
};

export default getResolver;
