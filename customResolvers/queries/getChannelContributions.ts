import { getChannelContributionsQuery } from "../cypher/cypherQueries.js";
import { DateTime } from "luxon";

interface Input {
  Channel: any;
  driver: any;
}

interface Args {
  channelUniqueName: string;
  startDate?: string;
  endDate?: string;
  year?: number;
  limit?: number;
}

const getChannelContributionsResolver = (input: Input) => {
  const { driver, Channel } = input;

  return async (_parent: any, args: Args) => {
    const { channelUniqueName, year, startDate, endDate, limit } = args;
    const session = driver.session({ defaultAccessMode: 'READ' });

    try {
      // Verify channel existence
      const channelExists = await Channel.find({
        where: { uniqueName: channelUniqueName },
        selectionSet: `{ uniqueName }`,
      });

      if (channelExists.length === 0) {
        throw new Error(`Channel ${channelUniqueName} not found.`);
      }

      // Determine effective date range
      const effectiveStartDate = year
        ? `${year}-01-01`
        : (startDate || DateTime.now().minus({ year: 1 }).toISODate());

      const effectiveEndDate = year
        ? `${year}-12-31`
        : (endDate || DateTime.now().toISODate());

      // Execute optimized Cypher query
      const result = await session.run(getChannelContributionsQuery, {
        channelUniqueName,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        limit: parseInt(String(limit || 10), 10),
      });

      // Map results to UserContributionData format
      const contributions = result.records.map((record: any) => {
        const dayData = record.get('dayData');

        // Log the dayData to debug null date issue
        console.log('Raw dayData:', JSON.stringify(dayData, null, 2));

        // Filter out any dayData entries with null dates
        const validDayData = Array.isArray(dayData)
          ? dayData.filter((day: any) => day && day.date != null)
          : [];

        return {
          username: record.get('username'),
          displayName: record.get('displayName'),
          profilePicURL: record.get('profilePicURL'),
          totalContributions: record.get('totalContributions').toNumber
            ? record.get('totalContributions').toNumber()
            : record.get('totalContributions'),
          dayData: validDayData,
        };
      });

      return contributions;

    } catch (error: any) {
      console.error("Error fetching channel contributions:", error);
      throw new Error(`Failed to fetch contributions for channel ${channelUniqueName}: ${error.message}`);
    } finally {
      await session.close();
    }
  };
};

export default getChannelContributionsResolver;
