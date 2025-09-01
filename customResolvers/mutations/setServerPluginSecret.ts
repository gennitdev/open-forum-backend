import crypto from 'crypto'
import type {
  ServerSecretModel
} from '../../ogm_types.js'

type Input = {
  ServerSecret: ServerSecretModel
}

type Args = {
  pluginId: string
  key: string
  value: string
}

// Simple encryption for demonstration - in production use proper key management
const ENCRYPTION_KEY = process.env.PLUGIN_SECRET_ENCRYPTION_KEY || 'your-32-char-secret-key-here!!!' // 32 chars
const ALGORITHM = 'aes-256-gcm'

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return iv.toString('hex') + ':' + encrypted
}

const getResolver = (input: Input) => {
  const { ServerSecret } = input

  return async (_parent: any, args: Args, _context: any, _resolveInfo: any) => {
    const { pluginId, key, value } = args

    try {
      // Encrypt the secret value
      const ciphertext = encrypt(value)

      // Find existing secret or create new one
      const existingSecrets = await ServerSecret.find({
        where: {
          AND: [
            { pluginId },
            { key }
          ]
        }
      })

      if (existingSecrets.length > 0) {
        // Update existing secret
        await ServerSecret.update({
          where: { id: existingSecrets[0].id },
          update: {
            ciphertext,
            isValid: false, // Reset validation status when value changes
            lastValidatedAt: null,
            validationError: null
          }
        })
      } else {
        // Create new secret
        await ServerSecret.create({
          input: [
            {
              pluginId,
              key,
              ciphertext,
              isValid: false,
              updatedAt: new Date().toISOString()
            }
          ]
        })
      }

      return true
    } catch (error) {
      console.error('Error in setServerPluginSecret resolver:', error)
      throw new Error(`Failed to set server plugin secret: ${(error as any).message}`)
    }
  }
}

export default getResolver