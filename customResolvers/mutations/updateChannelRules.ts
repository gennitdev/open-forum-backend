type Args = {
  channelUniqueName: string;
  rules: { summary: string; detail: string }[];
};

type Input = {
  Channel: any;
};

const getUpdateChannelRulesResolver = (input: Input) => {
  const { Channel } = input;
  return async (parent: any, args: Args, context: any, resolveInfo: any) => {
    const { channelUniqueName, rules } = args;

    if (!channelUniqueName || !rules) {
      throw new Error("Both channelUniqueName and rules are required");
    }

    try {
      const result = await Channel.find({
        where: {
          uniqueName: channelUniqueName,
        },
      });

      if (result.length === 0) {
        throw new Error("Channel not found");
      }

      const channel = result[0];

      await Channel.update({
        where: {
          uniqueName: channelUniqueName,
        },
        update: {
          rules,
        },
      });

      return {
        ...channel,
        rules,
      };
    } catch (e) {
      console.error(e);
      throw new Error("Failed to update channel rules");
    }
  };
};

export default getUpdateChannelRulesResolver;
