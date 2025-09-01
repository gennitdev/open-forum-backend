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
}

// Simple decryption for demonstration - in production use proper key management
const ENCRYPTION_KEY = process.env.PLUGIN_SECRET_ENCRYPTION_KEY || 'your-32-char-secret-key-here!!!' // 32 chars
const ALGORITHM = 'aes-256-gcm'

function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// Simple validation logic - in a real implementation, this would be plugin-specific
async function validateSecret(pluginId: string, key: string, value: string): Promise<{isValid: boolean, error?: string}> {
  try {
    // Example validation for different types of secrets
    if (key.toLowerCase().includes('api_key') || key.toLowerCase().includes('token')) {
      // For API keys, we might do a simple format check or a test API call
      if (value.length < 10) {
        return { isValid: false, error: 'API key too short' }
      }
      
      // You could add actual API validation here, e.g.:
      // if (key === 'VIRUS_TOTAL_API_KEY') {
      //   const response = await fetch('https://www.virustotal.com/vtapi/v2/file/report?apikey=' + value + '&resource=test')
      //   return { isValid: response.ok }
      // }
      
      return { isValid: true }
    }

    if (key.toLowerCase().includes('url') || key.toLowerCase().includes('endpoint')) {
      // Basic URL validation
      try {
        new URL(value)
        return { isValid: true }
      } catch {
        return { isValid: false, error: 'Invalid URL format' }
      }
    }

    // Default validation - just check it's not empty
    return { isValid: value.trim().length > 0 }
    
  } catch (error) {
    return { isValid: false, error: `Validation failed: ${(error as any).message}` }
  }
}

const getResolver = (input: Input) => {
  const { ServerSecret } = input

  return async (_parent: any, args: Args, _context: any, _resolveInfo: any) => {
    const { pluginId, key } = args

    try {
      // Find the secret
      const secrets = await ServerSecret.find({
        where: {
          AND: [
            { pluginId },
            { key }
          ]
        }
      })

      if (secrets.length === 0) {
        return {
          isValid: false,
          error: 'Secret not found'
        }
      }

      const secret = secrets[0]

      // Decrypt the secret value
      let decryptedValue: string
      try {
        decryptedValue = decrypt(secret.ciphertext)
      } catch (error) {
        await ServerSecret.update({
          where: { id: secret.id },
          update: {
            isValid: false,
            validationError: 'Failed to decrypt secret',
            lastValidatedAt: new Date().toISOString()
          }
        })
        
        return {
          isValid: false,
          error: 'Failed to decrypt secret'
        }
      }

      // Validate the secret
      const validationResult = await validateSecret(pluginId, key, decryptedValue)

      // Update the secret's validation status
      await ServerSecret.update({
        where: { id: secret.id },
        update: {
          isValid: validationResult.isValid,
          validationError: validationResult.error || null,
          lastValidatedAt: new Date().toISOString()
        }
      })

      return validationResult

    } catch (error) {
      console.error('Error in validateServerPluginSecret resolver:', error)
      throw new Error(`Failed to validate server plugin secret: ${(error as any).message}`)
    }
  }
}

export default getResolver