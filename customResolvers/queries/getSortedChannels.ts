type Input = {
  driver: any;
};

const DEFAULT_LIMIT = "25";
const DEFAULT_OFFSET = "0";

const getSortedChannelsResolver = (input: Input) => {
  const { driver } = input;

  return async (_parent: any, args: any, _context: any) => {
    const limit = args.limit || DEFAULT_LIMIT;
    const offset = args.offset || DEFAULT_OFFSET;
    const session = driver.session();

    try {
      const result = await session.run(
        `
        MATCH (c:Channel)
        // Count all DiscussionChannels with a valid Discussion
        OPTIONAL MATCH (c)<-[:POSTED_IN_CHANNEL]-(dc:DiscussionChannel)
        WHERE EXISTS((dc)-[:POSTED_IN_CHANNEL]->(:Discussion))
        WITH c, COUNT(dc) AS validDiscussionChannelsCount

        // Count EventChannels
        OPTIONAL MATCH (c)<-[:POSTED_IN_CHANNEL]-(ec:EventChannel)
        WITH c, validDiscussionChannelsCount, COUNT(ec) AS eventChannelsCount

        // Collect Tags
        OPTIONAL MATCH (c)-[:HAS_TAG]->(tag:Tag)
        WITH c, validDiscussionChannelsCount, eventChannelsCount, COLLECT(tag.text) AS tags

        // Order and paginate results
        ORDER BY validDiscussionChannelsCount DESC
        SKIP toInteger($offset)
        LIMIT toInteger($limit)

        // Return results
        RETURN {
          uniqueName: c.uniqueName,
          displayName: c.displayName,
          channelIconURL: c.channelIconURL,
          description: c.description,
          Tags: tags,
          EventChannelsAggregate: {
            count: eventChannelsCount
          },
          DiscussionChannelsAggregate: {
            count: validDiscussionChannelsCount
          }
        } AS channel
        `,
        {
          limit,
          offset,
        }
      );

      const channels = result.records.map((record: any) => record.get("channel"));
      return channels;
    } catch (error) {
      console.error("Error fetching sorted channels:", error);
      throw new Error("Failed to fetch sorted channels");
    } finally {
      await session.close();
    }
  };
};

export default getSortedChannelsResolver;
