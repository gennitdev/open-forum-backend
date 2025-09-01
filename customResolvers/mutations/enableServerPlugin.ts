import type {
  PluginModel,
  PluginVersionModel,
  ServerConfigModel,
  ServerSecretModel
} from '../../ogm_types.js'

type Input = {
  Plugin: PluginModel
  PluginVersion: PluginVersionModel
  ServerConfig: ServerConfigModel
  ServerSecret: ServerSecretModel
}

type Args = {
  pluginId: string
  version: string
  enabled: boolean
  settingsJson?: any
}

const getResolver = (input: Input) => {
  const { Plugin, PluginVersion, ServerConfig, ServerSecret } = input

  return async (_parent: any, args: Args, _context: any, _resolveInfo: any) => {
    const { pluginId, version, enabled, settingsJson = {} } = args

    try {
      // 1. Find the plugin and version
      const plugins = await Plugin.find({
        where: { name: pluginId },
        selectionSet: `{
          id
          name
          Versions(where: { version: "${version}" }) {
            id
            version
          }
        }`
      })

      if (!plugins.length) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      const plugin = plugins[0]
      const pluginVersion = plugin.Versions?.[0]
      
      if (!pluginVersion) {
        throw new Error(`Plugin ${pluginId} version ${version} not found`)
      }

      // 2. Get server config
      const serverConfigs = await ServerConfig.find({
        selectionSet: `{
          serverName
          InstalledVersions(where: { id: "${pluginVersion.id}" }) {
            id
            version
          }
        }`
      })

      if (!serverConfigs.length) {
        throw new Error('Server configuration not found')
      }

      const serverConfig = serverConfigs[0]
      const isInstalled = serverConfig.InstalledVersions?.length > 0

      if (!isInstalled) {
        throw new Error(`Plugin ${pluginId} version ${version} is not installed. Please install it first.`)
      }

      // 3. If enabling, check that all required secrets are present
      if (enabled) {
        // For now, we'll implement a basic check. In a real implementation,
        // you would need to parse the plugin manifest to get required secrets
        // This is a placeholder for the secret validation logic
        
        // Check if there are any secrets for this plugin that are marked as invalid
        const secrets = await ServerSecret.find({
          where: { pluginId },
          selectionSet: `{
            key
            isValid
            validationError
          }`
        })

        const invalidSecrets = secrets.filter(secret => secret.isValid === false && secret.validationError)
        if (invalidSecrets.length > 0) {
          throw new Error(`Cannot enable plugin: invalid secrets found for keys: ${invalidSecrets.map(s => s.key).join(', ')}`)
        }

        // TODO: Add logic to check against plugin manifest for required secrets
        // const manifest = await getPluginManifest(pluginId, version)
        // const requiredSecrets = manifest.secrets?.filter(s => s.scope === 'server') || []
        // const missingSecrets = requiredSecrets.filter(req => 
        //   !secrets.find(secret => secret.key === req.key)
        // )
        // if (missingSecrets.length > 0) {
        //   throw new Error(`Missing required secrets: ${missingSecrets.map(s => s.key).join(', ')}`)
        // }
      }

      // 4. Update the installation relationship
      await ServerConfig.update({
        where: { serverName: serverConfig.serverName },
        update: {
          InstalledVersions: [{
            where: { node: { id: pluginVersion.id } },
            update: {
              edge: {
                enabled,
                settingsJson
              }
            }
          }]
        }
      })

      return {
        plugin: {
          id: plugin.id,
          name: plugin.name
        },
        version,
        scope: 'SERVER',
        enabled,
        settingsJson
      }

    } catch (error) {
      console.error('Error in enableServerPlugin resolver:', error)
      throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} plugin: ${(error as any).message}`)
    }
  }
}

export default getResolver