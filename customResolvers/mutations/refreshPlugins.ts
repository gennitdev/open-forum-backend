import type {
  PluginModel,
  PluginVersionModel,
  ServerConfigModel
} from '../../ogm_types.js'
import { Storage } from '@google-cloud/storage'
import tar from 'tar-stream'
import zlib from 'zlib'

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

// Helper function to download and parse plugin manifest from tarball
async function getPluginManifest(tarballUrl: string): Promise<{ version: string; id: string; entryPath?: string }> {
  console.log(`Downloading and parsing manifest from: ${tarballUrl}`)
  
  // Download tarball
  let tarballBytes: Buffer
  if (tarballUrl.startsWith('gs://')) {
    const storage = new Storage()
    const gsPath = tarballUrl.replace('gs://', '')
    const [bucketName, ...pathParts] = gsPath.split('/')
    const filePath = pathParts.join('/')
    
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(filePath)
    
    const [contents] = await file.download()
    tarballBytes = contents
  } else {
    const response = await fetch(tarballUrl)
    if (!response.ok) {
      throw new Error(`Failed to download tarball: HTTP ${response.status}`)
    }
    tarballBytes = Buffer.from(await response.arrayBuffer())
  }

  // Parse manifest from tarball
  return new Promise<{ version: string; id: string; entryPath?: string }>((resolve, reject) => {
    const extract = tar.extract()
    const gunzip = zlib.createGunzip()
    
    let manifestData: any = null

    extract.on('entry', (header, stream, next) => {
      if (header.name.endsWith('plugin.json') || header.name === 'plugin.json') {
        let data = ''
        stream.on('data', chunk => data += chunk)
        stream.on('end', () => {
          try {
            manifestData = JSON.parse(data)
            console.log(`Found manifest for ${manifestData.id}@${manifestData.version}`)
          } catch (e) {
            return reject(new Error(`Invalid plugin.json: ${(e as any).message}`))
          }
          next()
        })
      } else {
        stream.on('end', next)
      }
      stream.resume()
    })

    extract.on('finish', () => {
      if (!manifestData) {
        return reject(new Error('Tarball missing plugin.json'))
      }
      resolve({
        version: manifestData.version,
        id: manifestData.id,
        entryPath: manifestData.entry || 'index.js'
      })
    })

    extract.on('error', reject)
    gunzip.on('error', reject)

    gunzip.pipe(extract)
    gunzip.write(tarballBytes)
    gunzip.end()
  })
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

      // First, find and fix any orphaned plugin versions that exist without Plugin connections
      console.log('Checking for orphaned plugin versions...')
      
      try {
        const allVersions = await PluginVersion.find({
          selectionSet: `{
            id
            version
            repoUrl
          }`
        })

        console.log(`Found ${allVersions.length} total plugin versions in database`)

        // Check each version to see if it has a Plugin relationship
        for (const version of allVersions) {
          try {
            // Use a more specific query that won't fail on null relationships
            // We'll try to find plugins that are connected to this version
            const connectedPlugins = await Plugin.find({
              where: {
                Versions: {
                  id: version.id
                }
              },
              selectionSet: `{
                id
                name
              }`
            })

            if (connectedPlugins.length === 0) {
              console.log(`Found orphaned version: ${version.version} (${version.repoUrl})`)
              
              // Try to match this version to a plugin from the registry
              for (const registryPlugin of registryData.plugins) {
                const matchingVersion = registryPlugin.versions.find(v => v.tarballUrl === version.repoUrl)
                if (matchingVersion) {
                  console.log(`Attempting to connect orphaned version to plugin: ${registryPlugin.id}`)
                  
                  // Find or create the plugin
                  let plugins = await Plugin.find({
                    where: { name: registryPlugin.id }
                  })

                  let plugin = plugins[0]
                  if (!plugin) {
                    console.log(`Creating plugin for orphaned version: ${registryPlugin.id}`)
                    const createResult = await Plugin.create({
                      input: [{ name: registryPlugin.id }]
                    })
                    plugin = createResult.plugins[0]
                  }

                  // Connect the orphaned version to the plugin
                  await PluginVersion.update({
                    where: { id: version.id },
                    connect: {
                      Plugin: {
                        where: { node: { id: plugin.id } }
                      }
                    }
                  })
                  
                  console.log(`Successfully connected orphaned version ${version.version} to plugin ${registryPlugin.id}`)
                  break
                }
              }
            }
          } catch (versionError) {
            console.warn(`Skipping version ${version.id} due to error:`, (versionError as any).message)
          }
        }
      } catch (orphanError) {
        console.warn('Error while checking orphaned versions:', (orphanError as any).message)
        // Continue with normal processing even if orphan check fails
      }

      console.log('Finished checking orphaned versions, proceeding with registry processing...')

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
          try {
            // Download and parse the plugin manifest to get the actual plugin version
            const manifest = await getPluginManifest(registryVersion.tarballUrl)
            
            console.log(`Registry version: ${registryVersion.version}, Manifest version: ${manifest.version}`)
            
            // Verify plugin ID matches
            if (manifest.id !== registryPlugin.id) {
              console.warn(`Plugin ID mismatch: registry=${registryPlugin.id}, manifest=${manifest.id}. Skipping.`)
              continue
            }
            
            // Check if this version already exists (by manifest version + repoUrl)
            const existingVersions = await PluginVersion.find({
              where: {
                AND: [
                  { version: manifest.version }, // Use manifest version
                  { repoUrl: registryVersion.tarballUrl }
                ]
              }
            })

            if (existingVersions.length === 0) {
              // Version doesn't exist at all, create it using manifest version
              console.log(
                `Creating new plugin version: ${registryPlugin.id}@${manifest.version} (registry: ${registryVersion.version})`
              )
              await PluginVersion.create({
                input: [
                  {
                    version: manifest.version, // Use manifest version
                    repoUrl: registryVersion.tarballUrl,
                    tarballGsUri: registryVersion.tarballUrl,
                    integritySha256: registryVersion.integritySha256,
                    entryPath: manifest.entryPath || 'index.js',
                    Plugin: {
                      connect: {
                        where: { node: { id: plugin.id } }
                      }
                    }
                  }
                ]
              })
            } else {
              // Version exists, but make sure it's connected to this plugin
              const existingVersion = existingVersions[0]
              console.log(
                `Plugin version already exists: ${registryPlugin.id}@${manifest.version}, ensuring connection`
              )
              
              // Check if it's already connected to this plugin
              const connectedPlugins = await Plugin.find({
                where: {
                  AND: [
                    { id: plugin.id },
                    { Versions: { id: existingVersion.id } }
                  ]
                }
              })
              
              if (connectedPlugins.length === 0) {
                // Version exists but isn't connected to this plugin, connect it
                console.log(`Connecting existing version ${manifest.version} to plugin ${registryPlugin.id}`)
                await PluginVersion.update({
                  where: { id: existingVersion.id },
                  update: {
                    tarballGsUri: registryVersion.tarballUrl,
                    integritySha256: registryVersion.integritySha256
                  },
                  connect: {
                    Plugin: {
                      where: { node: { id: plugin.id } }
                    }
                  }
                })
              } else {
                // Version is already connected, but ensure it has the latest integrity data
                console.log(`Updating existing version ${manifest.version} with integrity data`)
                await PluginVersion.update({
                  where: { id: existingVersion.id },
                  update: {
                    tarballGsUri: registryVersion.tarballUrl,
                    integritySha256: registryVersion.integritySha256
                  }
                })
              }
            }
          } catch (error) {
            console.warn(`Failed to process version ${registryVersion.version} for plugin ${registryPlugin.id}:`, (error as any).message)
            // Continue with next version on error
            continue
          }
        }
      }

      console.log(`Successfully refreshed ${updatedPlugins.length} plugins`)
      
      // Before returning, make sure all plugins have their Versions relationship properly loaded
      const pluginsWithVersions = []
      for (const plugin of updatedPlugins) {
        try {
          const pluginWithVersions = await Plugin.find({
            where: { id: plugin.id },
            selectionSet: `{
              id
              name
              Versions {
                id
                version
                repoUrl
                entryPath
              }
            }`
          })
          
          if (pluginWithVersions[0]) {
            pluginsWithVersions.push(pluginWithVersions[0])
          }
        } catch (error) {
          console.warn(`Could not load versions for plugin ${plugin.id}:`, (error as any).message)
          // Still include the plugin but with empty versions array
          pluginsWithVersions.push({
            ...plugin,
            Versions: []
          })
        }
      }
      
      return pluginsWithVersions
    } catch (error) {
      console.error('Error in refreshPlugins resolver:', error)
      throw new Error(`Failed to refresh plugins: ${(error as any).message}`)
    }
  }
}

export default getResolver
