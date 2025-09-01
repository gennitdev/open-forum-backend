import type {
  PluginModel,
  PluginVersionModel,
  ServerConfigModel
} from '../../ogm_types.js'
import { Storage } from '@google-cloud/storage'

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

      console.log('Found server configs:', serverConfigs.length)
      console.log('Server config pluginRegistries:', serverConfigs[0]?.pluginRegistries)

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
          // For Google Cloud Storage URLs, use authenticated GCS client
          const storage = new Storage()
          const gsPath = registryUrl.replace('gs://', '')
          const [bucketName, ...pathParts] = gsPath.split('/')
          const filePath = pathParts.join('/')
          
          console.log(`Downloading from GCS bucket: ${bucketName}, file: ${filePath}`)
          
          const bucket = storage.bucket(bucketName)
          const file = bucket.file(filePath)
          
          const [contents] = await file.download()
          registryData = JSON.parse(contents.toString())
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
          // First, check if this version exists but isn't connected to any plugin
          const orphanedVersions = await PluginVersion.find({
            where: {
              AND: [
                { version: registryVersion.version },
                { repoUrl: registryVersion.tarballUrl }
              ]
            },
            selectionSet: `{
              id
              Plugin {
                id
              }
            }`
          })

          let versionExists = false
          
          for (const existingVersion of orphanedVersions) {
            if (existingVersion.Plugin) {
              // Version is already connected to a plugin
              if (existingVersion.Plugin.id === plugin.id) {
                console.log(
                  `Plugin version already connected: ${registryPlugin.id}@${registryVersion.version}`
                )
                versionExists = true
              }
            } else {
              // Version exists but not connected to any plugin - connect it
              console.log(
                `Connecting orphaned version to plugin: ${registryPlugin.id}@${registryVersion.version}`
              )
              await PluginVersion.update({
                where: { id: existingVersion.id },
                connect: {
                  Plugin: {
                    where: { node: { id: plugin.id } }
                  }
                }
              })
              versionExists = true
            }
          }

          if (!versionExists) {
            console.log(
              `Creating new plugin version: ${registryPlugin.id}@${registryVersion.version}`
            )
            await PluginVersion.create({
              input: [
                {
                  version: registryVersion.version,
                  repoUrl: registryVersion.tarballUrl,
                  entryPath: 'index.js', // Default entry path
                  Plugin: {
                    connect: {
                      where: { node: { id: plugin.id } }
                    }
                  }
                }
              ]
            })
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
