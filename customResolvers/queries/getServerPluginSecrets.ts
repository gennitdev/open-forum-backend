import type {
  ServerSecretModel
} from '../../ogm_types.js'

type Input = {
  ServerSecret: ServerSecretModel
}

type Args = {
  pluginId: string
}

const getResolver = (input: Input) => {
  const { ServerSecret } = input

  return async (_parent: any, args: Args, _context: any, _resolveInfo: any) => {
    const { pluginId } = args

    try {
      // Find all secrets for this plugin
      const secrets = await ServerSecret.find({
        where: { pluginId },
        selectionSet: `{
          key
          isValid
          lastValidatedAt
          validationError
        }`
      })

      // Map to the response format
      return secrets.map(secret => ({
        key: secret.key,
        status: secret.lastValidatedAt 
          ? (secret.isValid ? 'VALID' : 'INVALID')
          : 'SET_UNTESTED',
        lastValidatedAt: secret.lastValidatedAt,
        validationError: secret.validationError
      }))

    } catch (error) {
      console.error('Error in getServerPluginSecrets resolver:', error)
      throw new Error(`Failed to get server plugin secrets: ${(error as any).message}`)
    }
  }
}

export default getResolver