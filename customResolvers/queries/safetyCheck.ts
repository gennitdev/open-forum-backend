// type EnvironmentInfo {
//     isTestEnvironment
//     currentDatabase
// }

// type SafetyCheckResponse {
//   environment: EnvironmentInfo
// }

const safetyCheck = async (
  parent: any,
  args: any,
  context: any,
  info: any
) => {
  return {
    environment: {
      isTestEnvironment: process.env.NEO4J_URI?.includes('localhost'),
      currentDatabase: process.env.NEO4J_URI,
    },
  };
};
export default safetyCheck;
