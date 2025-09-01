import crypto from 'crypto'
import { Storage } from '@google-cloud/storage'
import tar from 'tar-stream'
import zlib from 'zlib'
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

type Args = {
  pluginId: string
  version: string
}

const getResolver = (input: Input) => {
  const { Plugin, PluginVersion, ServerConfig } = input

  return async (_parent: any, args: Args, _context: any, _resolveInfo: any) => {
    const { pluginId, version } = args

    try {
      // 1. Get server config to find registry URLs
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

      // 2. Fetch and find plugin version in registry
      let registryData: PluginRegistry
      try {
        if (registryUrl.startsWith('gs://')) {
          const storage = new Storage()
          const gsPath = registryUrl.replace('gs://', '')
          const [bucketName, ...pathParts] = gsPath.split('/')
          const filePath = pathParts.join('/')
          
          const bucket = storage.bucket(bucketName)
          const file = bucket.file(filePath)
          
          const [contents] = await file.download()
          registryData = JSON.parse(contents.toString())
        } else {
          const response = await fetch(registryUrl)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          registryData = await response.json()
        }
      } catch (error) {
        throw new Error(`Failed to fetch plugin registry: ${(error as any).message}`)
      }

      // First, get the plugin name from database (since pluginId might be a UUID)
      let pluginName = pluginId
      const existingPlugins = await Plugin.find({
        where: { id: pluginId },
        selectionSet: `{ id name }`
      })
      
      if (existingPlugins.length > 0) {
        // If found by ID, use the name for registry lookup
        pluginName = existingPlugins[0].name
      }

      // Find the specific plugin and version in registry using the plugin name
      const registryPlugin = registryData.plugins.find(p => p.id === pluginName)
      if (!registryPlugin) {
        throw new Error(`Plugin ${pluginName} not found in registry`)
      }

      const registryVersion = registryPlugin.versions.find(v => v.version === version)
      if (!registryVersion) {
        throw new Error(`Plugin ${pluginName} version ${version} not found in registry`)
      }

      // Debug logging to see what we're getting from registry
      console.log('Registry version data:', JSON.stringify(registryVersion, null, 2))

      // 3. Download and verify tarball integrity
      console.log(`Downloading tarball from: ${registryVersion.tarballUrl}`)
      
      let tarballBytes: Buffer
      if (registryVersion.tarballUrl.startsWith('gs://')) {
        const storage = new Storage()
        const gsPath = registryVersion.tarballUrl.replace('gs://', '')
        const [bucketName, ...pathParts] = gsPath.split('/')
        const filePath = pathParts.join('/')
        
        const bucket = storage.bucket(bucketName)
        const file = bucket.file(filePath)
        
        const [contents] = await file.download()
        tarballBytes = contents
      } else {
        const response = await fetch(registryVersion.tarballUrl)
        if (!response.ok) {
          throw new Error(`Failed to download tarball: HTTP ${response.status}`)
        }
        tarballBytes = Buffer.from(await response.arrayBuffer())
      }

      // 4. Verify integrity
      const actualSha256 = crypto.createHash('sha256').update(tarballBytes).digest('hex')
      if (actualSha256 !== registryVersion.integritySha256) {
        throw new Error('Tarball integrity verification failed: SHA-256 mismatch')
      }

      // 5. Quick validate tarball contents
      await new Promise<void>((resolve, reject) => {
        const extract = tar.extract()
        const gunzip = zlib.createGunzip()
        
        let hasPluginJson = false
        let manifestData: any = null
        let hasEntryFile = false

        extract.on('entry', (header, stream, next) => {
          if (header.name.endsWith('plugin.json') || header.name === 'plugin.json') {
            hasPluginJson = true
            let data = ''
            stream.on('data', chunk => data += chunk)
            stream.on('end', () => {
              try {
                manifestData = JSON.parse(data)
                if (manifestData.version !== version) {
                  return reject(new Error(`Manifest version ${manifestData.version} doesn't match requested version ${version}`))
                }
                if (manifestData.id !== pluginName) {
                  return reject(new Error(`Manifest ID ${manifestData.id} doesn't match requested plugin name ${pluginName}`))
                }
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
          if (!hasPluginJson) {
            return reject(new Error('Tarball missing plugin.json'))
          }
          if (!manifestData?.entry) {
            return reject(new Error('plugin.json missing entry field'))
          }
          resolve()
        })

        extract.on('error', reject)
        gunzip.on('error', reject)

        gunzip.pipe(extract)
        gunzip.write(tarballBytes)
        gunzip.end()
      })

      // 6. Find or create Plugin record (reuse existing plugin if found earlier)
      let plugin = existingPlugins[0]
      if (!plugin) {
        // Try to find by name if not found by ID
        const pluginsByName = await Plugin.find({
          where: { name: pluginName }
        })
        plugin = pluginsByName[0]

        if (!plugin) {
          console.log(`Creating new plugin: ${pluginName}`)
          const createResult = await Plugin.create({
            input: [
              {
                name: pluginName
              }
            ]
          })
          plugin = createResult.plugins[0]
        }
      }

      // 7. Check if version already exists and is installed
      const existingVersions = await PluginVersion.find({
        where: {
          AND: [
            { version },
            { Plugin: { id: plugin.id } }
          ]
        },
        selectionSet: `{
          id
          version
          Plugin {
            id
            name
          }
        }`
      })

      let pluginVersion = existingVersions[0]
      
      if (!pluginVersion) {
        // Create new plugin version
        console.log(`Creating new plugin version: ${pluginName}@${version}`)
        
        // Ensure all fields are proper strings
        const repoUrl = String(registryVersion.tarballUrl)
        const tarballGsUri = String(registryVersion.tarballUrl)
        const integritySha256 = String(registryVersion.integritySha256)
        
        const createResult = await PluginVersion.create({
          input: [
            {
              version,
              repoUrl,
              tarballGsUri,
              integritySha256,
              entryPath: 'dist/index.js', // Default entry path
              Plugin: {
                connect: {
                  where: { node: { id: plugin.id } }
                }
              }
            }
          ]
        })
        pluginVersion = createResult.pluginVersions[0]
      } else {
        // Plugin version already exists, skip update for now to avoid Map error
        console.log('Plugin version already exists, skipping update to avoid Map error')
      }

      // 8. Register installation relationship (idempotent)
      const serverConfig = serverConfigs[0]
      
      // Check if already installed
      const installedVersions = await ServerConfig.find({
        where: { serverName: serverConfig.serverName },
        selectionSet: `{
          InstalledVersions(where: { id: "${pluginVersion.id}" }) {
            id
            version
            Plugin {
              id
              name
            }
          }
        }`
      })

      const isAlreadyInstalled = installedVersions[0]?.InstalledVersions?.length > 0

      if (!isAlreadyInstalled) {
        await ServerConfig.update({
          where: { serverName: serverConfig.serverName },
          connect: {
            InstalledVersions: [{
              where: { node: { id: pluginVersion.id } },
              edge: {
                enabled: false,
                settingsJson: {}
              }
            }]
          }
        })
      }

      return {
        plugin: {
          id: plugin.id,
          name: plugin.name
        },
        version,
        scope: 'SERVER',
        enabled: false,
        settingsJson: {}
      }

    } catch (error) {
      console.error('Error in installPluginVersion resolver:', error)
      throw new Error(`Failed to install plugin: ${(error as any).message}`)
    }
  }
}

export default getResolver