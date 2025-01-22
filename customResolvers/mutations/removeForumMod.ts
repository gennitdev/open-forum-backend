import type { ChannelUpdateInput } from "../../ogm-types.js";

type Args = {
  inviteeUsername: string;
  channelUniqueName: string;
};

type Input = { 
  Channel: any 
};

const getResolver = (input: Input) => {
  const { Channel } = input; // This refers to the OGM model
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { channelUniqueName, inviteeUsername } = args;

    if (!channelUniqueName || !inviteeUsername) {
      throw new Error(
        "All arguments (channelUniqueName, inviteeUsername) are required"
      );
    }

    // const channelUpdateInput: ChannelUpdateInput = {
    //     PendingOwnerInvites: {
    //       connect: {
    //         username: inviteeUsername,
    //       },
    //     },
    //   },

    try {
      const result = await Channel.update({
        where: {
          uniqueName: channelUniqueName,
        },
        // update: 
      });
      if (result.length === 0) {
        throw new Error("Channel not found");
      }
    } catch (e) {
      console.error(e);
    }
  };
};

export default getResolver;
