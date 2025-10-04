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
      console.log('Query parameters:', {
        channelUniqueName,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        limit: parseInt(String(limit || 10), 10),
      });

      // Debug: Test each step of the query
      const debugQuery1 = `MATCH (channel:Channel {uniqueName: $channelUniqueName}) RETURN channel.uniqueName`;
      const debug1 = await session.run(debugQuery1, { channelUniqueName });
      console.log('Debug 1 - Channel found:', debug1.records.length > 0);

      const debugQuery2 = `
        MATCH (channel:Channel {uniqueName: $channelUniqueName})
        MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)
        RETURN count(dc) as dcCount
      `;
      const debug2 = await session.run(debugQuery2, { channelUniqueName });
      console.log('Debug 2 - DiscussionChannels found:', debug2.records[0]?.get('dcCount').toNumber());

      const debugQuery3 = `
        MATCH (channel:Channel {uniqueName: $channelUniqueName})
        MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)
        MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
        RETURN count(d) as discussionCount
      `;
      const debug3 = await session.run(debugQuery3, { channelUniqueName });
      console.log('Debug 3 - Discussions found via DiscussionChannel:', debug3.records[0]?.get('discussionCount').toNumber());

      const debugQuery4 = `
        MATCH (channel:Channel {uniqueName: $channelUniqueName})
        MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)
        MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
        MATCH (u:User)-[:POSTED_DISCUSSION]->(d)
        RETURN count(u) as userCount
      `;
      const debug4 = await session.run(debugQuery4, { channelUniqueName });
      console.log('Debug 4 - Users found:', debug4.records[0]?.get('userCount').toNumber());

      const debugQuery5 = `
        MATCH (channel:Channel {uniqueName: $channelUniqueName})
        MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)
        MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
        RETURN d.createdAt as createdAt,
               date(datetime(d.createdAt)) as dateOnly,
               toString(d.createdAt) as createdAtString
        LIMIT 5
      `;
      const debug5 = await session.run(debugQuery5, { channelUniqueName });
      console.log('Debug 5 - Sample Discussion createdAt values:');
      debug5.records.forEach((r: any) => {
        console.log('  - Raw:', r.get('createdAt'));
        console.log('    Date:', r.get('dateOnly'));
        console.log('    String:', r.get('createdAtString'));
      });

      const debugQuery6 = `
        RETURN date($startDate) as parsedStartDate,
               date($endDate) as parsedEndDate
      `;
      const debug6 = await session.run(debugQuery6, {
        startDate: effectiveStartDate,
        endDate: effectiveEndDate
      });
      console.log('Debug 6 - Date parsing:');
      console.log('  Start date string:', effectiveStartDate);
      console.log('  Parsed start:', debug6.records[0]?.get('parsedStartDate'));
      console.log('  End date string:', effectiveEndDate);
      console.log('  Parsed end:', debug6.records[0]?.get('parsedEndDate'));

      const debugQuery7 = `
        MATCH (channel:Channel {uniqueName: $channelUniqueName})
        MATCH (dc:DiscussionChannel)-[:POSTED_IN_CHANNEL]->(channel)
        MATCH (dc)-[:POSTED_IN_CHANNEL]->(d:Discussion)
        MATCH (u:User)-[:POSTED_DISCUSSION]->(d)
        WITH d, date(datetime(d.createdAt)) as discussionDate, date($startDate) as startDate, date($endDate) as endDate
        RETURN discussionDate, startDate, endDate,
               discussionDate >= startDate as afterStart,
               discussionDate <= endDate as beforeEnd
        LIMIT 5
      `;
      const debug7 = await session.run(debugQuery7, {
        channelUniqueName,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate
      });
      console.log('Debug 7 - Date comparisons:');
      debug7.records.forEach((r: any) => {
        console.log('  Discussion:', r.get('discussionDate'), 'Start:', r.get('startDate'), 'End:', r.get('endDate'));
        console.log('    After start?', r.get('afterStart'), 'Before end?', r.get('beforeEnd'));
      });

      const result = await session.run(getChannelContributionsQuery, {
        channelUniqueName,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        limit: parseInt(String(limit || 10), 10),
      });

      console.log('Query returned', result.records.length, 'records');

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
