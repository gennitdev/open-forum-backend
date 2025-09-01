import type {
  PluginModel,
  PluginVersionModel,
  ServerConfigModel
} from '../../ogm_types.js'

type RegistryPlugin = {
  id: string
  versions: {
    version: string
    tarballUrl: string
    integritySha256: string
  }[]
}

type PluginRegistry = {
  updatedAt: string
  plugins: RegistryPlugin[]
}

type Input = {
  Plugin: PluginModel
  PluginVersion: PluginVersionModel
  ServerConfig: ServerConfigModel
}

const getResolver = (input: Input) => {
  const { Plugin, PluginVersion, ServerConfig } = input

  return async (_parent: any, _args: any, _context: any, _resolveInfo: any) => {
    try {
      // Get the server config to find registry URLs
      const serverConfigs = await ServerConfig.find({
        selectionSet: `{
          pluginRegistries
        }`
      })

      if (!serverConfigs.length || !serverConfigs[0].pluginRegistries?.length) {
        throw new Error('No plugin registries configured')
      }

      const registryUrl = serverConfigs[0].pluginRegistries?.[0]
      if (!registryUrl) {
        throw new Error('No plugin registry URL configured')
      }
      
      console.log(`Fetching plugin registry from: ${registryUrl}`)

      // Fetch registry data
      let registryData: PluginRegistry
      try {
        if (registryUrl.startsWith('gs://')) {
          // For Google Cloud Storage URLs, we need to use the public URL format
          const httpUrl = registryUrl.replace(
            'gs://',
            'https://storage.googleapis.com/'
          )
          const response = await fetch(httpUrl)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          registryData = await response.json()
        } else {
          // For regular HTTP/HTTPS URLs
          const response = await fetch(registryUrl)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          registryData = await response.json()
        }
      } catch (error) {
        console.error('Failed to fetch plugin registry:', error)
        throw new Error(
          `Failed to fetch plugin registry: ${(error as any).message}`
        )
      }

      console.log(`Registry updated at: ${registryData.updatedAt}`)
      console.log(`Found ${registryData.plugins.length} plugins in registry`)

      const updatedPlugins: any[] = []

      // Process each plugin in the registry
      for (const registryPlugin of registryData.plugins) {
        // Find or create the plugin
        let existingPlugins = await Plugin.find({
          where: { name: registryPlugin.id }
        })

        let plugin = existingPlugins[0]
        if (!plugin) {
          console.log(`Creating new plugin: ${registryPlugin.id}`)
          const createResult = await Plugin.create({
            input: [
              {
                name: registryPlugin.id // Use id as name for now
              }
            ]
          })
          plugin = createResult.plugins[0]
        }

        updatedPlugins.push(plugin)

        // Process each version of the plugin
        for (const registryVersion of registryPlugin.versions) {
          // Check if this version already exists
          const existingVersions = await PluginVersion.find({
            where: {
              AND: [
                { version: registryVersion.version },
                { repoUrl: registryVersion.tarballUrl }
              ]
            }
          })

          if (existingVersions.length === 0) {
            console.log(
              `Creating new plugin version: ${registryPlugin.id}@${registryVersion.version}`
            )
            await PluginVersion.create({
              input: [
                {
                  version: registryVersion.version,
                  repoUrl: registryVersion.tarballUrl,
                  entryPath: 'index.js' // Default entry path
                }
              ]
            })
          } else {
            console.log(
              `Plugin version already exists: ${registryPlugin.id}@${registryVersion.version}`
            )
          }
        }
      }

      console.log(`Successfully refreshed ${updatedPlugins.length} plugins`)
      return updatedPlugins
    } catch (error) {
      console.error('Error in refreshPlugins resolver:', error)
      throw new Error(`Failed to refresh plugins: ${(error as any).message}`)
    }
  }
}

export default getResolver
