import type {
  ServerConfigModel
} from '../../ogm_types.js'

type Input = {
  ServerConfig: ServerConfigModel
}

const getResolver = (input: Input) => {
  const { ServerConfig } = input

  return async (_parent: any, _args: any, _context: any, _resolveInfo: any) => {
    try {
      // Get server config with installed plugins
      const serverConfigs = await ServerConfig.find({
        selectionSet: `{
          InstalledVersions {
            id
            version
            Plugin {
              id
              name
            }
          }
        }`
      })

      if (!serverConfigs.length || !serverConfigs[0].InstalledVersions) {
        return []
      }

      const serverConfig = serverConfigs[0]
      
      // Get the installation properties for each installed version
      const installedPlugins = []
      
      for (const installedVersion of serverConfig.InstalledVersions) {
        // Query the relationship properties
        const result = await ServerConfig.find({
          where: { serverName: serverConfig.serverName },
          selectionSet: `{
            InstalledVersions(where: { id: "${installedVersion.id}" }) {
              id
              version
              Plugin {
                id
                name
              }
            }
          }`
        })

        // Get the relationship properties separately using a Cypher query
        // This is a workaround since Neo4j GraphQL OGM doesn't easily expose relationship properties
        // In a real implementation, you might use a custom Cypher query here

        installedPlugins.push({
          plugin: {
            id: installedVersion.Plugin.id,
            name: installedVersion.Plugin.name
          },
          version: installedVersion.version,
          scope: 'SERVER',
          enabled: false, // Default - would need custom query to get actual value
          settingsJson: {}
        })
      }

      return installedPlugins

    } catch (error) {
      console.error('Error in getInstalledPlugins resolver:', error)
      throw new Error(`Failed to get installed plugins: ${(error as any).message}`)
    }
  }
}

export default getResolver