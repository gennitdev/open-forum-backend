import { getUserContributionsQuery } from "../cypher/cypherQueries.js";
import { DateTime } from "luxon";

// The shape of the data to return matches the Vue component requirements
interface CommentType {
  id: string;
  text?: string | null;
  createdAt: string;
}

interface DiscussionType {
  id: string;
  title: string;
  createdAt: string;
}

interface EventType {
  id: string;
  title: string;
  createdAt: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  Comments: CommentType[];
  Discussions: DiscussionType[];
  Events: EventType[];
}

interface DayData {
  date: string;
  count: number;
  activities: Activity[];
}

type WeekData = DayData[];
type ContributionData = WeekData[];

type Input = {
  User: any;
  driver: any;
};

type Args = {
  username: string;
  startDate?: string;
  endDate?: string;
  year?: number;
};

// Function to convert flat data to the required nested structure
function formatContributionData(flatData: any[]): ContributionData {
  // If no data, return empty array
  if (!flatData || flatData.length === 0) {
    return [];
  }

  // Sort by date
  flatData.sort((a, b) => a.date.localeCompare(b.date));

  // Fill in missing dates with zero counts
  const allDates = fillMissingDates(flatData);

  // Group days by week
  const weeks: { [weekKey: string]: DayData[] } = {};
  
  allDates.forEach(day => {
    // Parse the date to get week number
    const date = DateTime.fromISO(day.date);
    const weekKey = `${date.year}-${date.weekNumber}`;
    
    if (!weeks[weekKey]) {
      weeks[weekKey] = [];
    }

    const isoDate = day.date.includes('T') ? day.date.split('T')[0] : day.date;
    
    weeks[weekKey].push({
      date: isoDate,
      count: typeof day.count === 'object' && day.count !== null ? 
             (typeof day.count.low === 'number' ? day.count.low : parseInt(day.count.toString(), 10)) : 
             (typeof day.count === 'number' ? day.count : 0),
      activities: day.activities || []
    });
  });

  // Convert to array of arrays and sort by week
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, days]) => days);
}

// Function to fill in missing dates with zero counts
function fillMissingDates(data: any[]): any[] {
  if (!data || data.length === 0) {
    return [];
  }

  // Limit the range to avoid excessive memory usage
  // Get min and max dates from actual data
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = DateTime.fromISO(sortedData[0].date);
  const endDate = DateTime.fromISO(sortedData[sortedData.length - 1].date);
  
  // If range is too large, limit to 53 weeks (1 year + 1 week buffer)
  const maxDays = 371; // 53 weeks
  const actualDays = endDate.diff(startDate, 'days').days;
  const effectiveEndDate = actualDays > maxDays ? 
                          startDate.plus({ days: maxDays }) : 
                          endDate;
  
  // Create a map of existing dates
  const dateMap = new Map();
  sortedData.forEach(item => {
    dateMap.set(item.date, item);
  });
  
  // Generate the full date range
  const result = [];
  let currentDate = startDate;
  
  while (currentDate <= effectiveEndDate) {
    const dateString = currentDate.toISODate();
    if (dateMap.has(dateString)) {
      result.push(dateMap.get(dateString));
    } else {
      // Add a zero-count entry for missing dates
      result.push({
        date: dateString,
        count: 0,
        activities: []
      });
    }
    currentDate = currentDate.plus({ days: 1 });
  }
  
  return result;
}

const getUserContributionsResolver = (input: Input) => {
  const { driver, User } = input;
  
  return async (_parent: any, args: Args, _context: any) => {
    const { username, startDate, endDate, year } = args;
    const session = driver.session({ defaultAccessMode: 'READ' }); // Use READ mode for queries
    
    try {
      // Verify user exists
      const userExists = await User.find({
        where: {
          username
        },
        selectionSet: `{
          username
        }`
      });

      if (userExists.length === 0) {
        throw new Error(`User ${username} not found`);
      }

      let effectiveStartDate: string;
      let effectiveEndDate: string;
      
      // If year is provided, use it for date range
      if (year) {
        effectiveStartDate = `${year}-01-01`;
        effectiveEndDate = `${year}-12-31`;
      } else {
        // Default date range is last year (52 weeks)
        const today = DateTime.now();
        const defaultStartDate = today.minus({ days: 365 }).toISODate();
        const defaultEndDate = today.toISODate();
        
        // Use provided dates or defaults
        effectiveStartDate = startDate || defaultStartDate;
        effectiveEndDate = endDate || defaultEndDate;
        
        // Ensure date range isn't too large (limit to 365 days max)
        const startDateTime = DateTime.fromISO(effectiveStartDate);
        const endDateTime = DateTime.fromISO(effectiveEndDate);
        
        if (endDateTime.diff(startDateTime, 'days').days > 365) {
          effectiveStartDate = endDateTime.minus({ days: 365 }).toISODate() || defaultStartDate;
        }
      }

      // Execute contribution query with optimized parameters
      const result = await session.run(getUserContributionsQuery, {
        username,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate
      });

      // Transform Neo4j records into the expected format with strict validation
      const contributionData = result.records.map((record: any) => {
        const activities = record.get('activities').map((activity: any) => {
          // Helper function to validate objects in arrays
          const validateArrayItem = (item: any) => {
            return item && typeof item === 'object' && item.id && typeof item.id === 'string';
          };
          
          return {
            id: activity.id || `activity-${DateTime.now().toMillis()}`,
            type: activity.type || 'unknown',
            description: activity.description || '',
            // Ensure arrays only contain valid objects with required fields
            Comments: Array.isArray(activity.Comments) 
              ? activity.Comments.filter(validateArrayItem) 
              : [],
            Discussions: Array.isArray(activity.Discussions) 
              ? activity.Discussions.filter(validateArrayItem) 
              : [],
            Events: Array.isArray(activity.Events) 
              ? activity.Events.filter(validateArrayItem) 
              : []
          };
        });
        
        return {
          date: record.get('date'),
          count: record.get('count'),
          activities
        };
      });

      // Format data into the expected structure
      return formatContributionData(contributionData);
    } catch (error: any) {
      console.error("Error fetching user contributions:", error);
      // More specific error handling
      if (error.message && error.message.includes("memory")) {
        throw new Error(`Memory limit reached. Try requesting a smaller date range.`);
      }
      throw new Error(`Failed to fetch contributions for user ${username}: ${error.message}`);
    } finally {
      await session.close();
    }
  };
};

export default getUserContributionsResolver;