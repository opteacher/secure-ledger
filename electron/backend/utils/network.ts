/**
 * Network utility functions for IP detection and validation
 */
import { networkInterfaces } from 'os'

/**
 * Get all local IPv4 addresses (excluding loopback)
 */
export function getLocalIPs(): string[] {
  const nets = networkInterfaces()
  const results: string[] = []
  
  for (const name of Object.keys(nets)) {
    const netInfos = nets[name]
    if (!netInfos) continue
    
    for (const net of netInfos) {
      // Skip internal and non-IPv4
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address)
      }
    }
  }
  
  return results
}

/**
 * Check if an IP is within a CIDR range
 * @param ip The IP address to check
 * @param cidr The CIDR range (e.g., '192.168.1.0/24' or '192.168.1.1' for single IP)
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    // Normalize single IP to /32
    const normalizedCIDR = cidr.includes('/') ? cidr : `${cidr}/32`
    
    const [range, bits] = normalizedCIDR.split('/')
    const mask = parseInt(bits, 10)
    
    if (mask < 0 || mask > 32) return false
    
    // Convert IPs to integers
    const ipInt = ipToInt(ip)
    const rangeInt = ipToInt(range)
    
    if (ipInt === null || rangeInt === null) return false
    
    // Calculate network mask
    const maskInt = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0
    
    // Check if IP is in range
    return (ipInt & maskInt) === (rangeInt & maskInt)
  } catch {
    return false
  }
}

/**
 * Convert IP string to integer
 */
function ipToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  
  let result = 0
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (isNaN(num) || num < 0 || num > 255) return null
    result = (result << 8) + num
  }
  
  return result >>> 0
}

/**
 * Check if a string is a valid IP address
 */
export function isValidIP(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  
  return parts.every(part => {
    const num = parseInt(part, 10)
    return !isNaN(num) && num >= 0 && num <= 255
  })
}

/**
 * Check if a string is a valid CIDR notation
 */
export function isValidCIDR(cidr: string): boolean {
  if (!cidr.includes('/')) return isValidIP(cidr)
  
  const [ip, bits] = cidr.split('/')
  const mask = parseInt(bits, 10)
  
  return isValidIP(ip) && !isNaN(mask) && mask >= 0 && mask <= 32
}

/**
 * Normalize an IP or CIDR to CIDR notation
 * Single IP becomes /32
 */
export function normalizeToCIDR(ipOrCIDR: string): string {
  if (ipOrCIDR.includes('/')) return ipOrCIDR
  return `${ipOrCIDR}/32`
}

/**
 * Check if two IPs are in the same private subnet
 * Useful for determining if two machines are likely on the same network
 */
export function areInSameSubnet(ip1: string, ip2: string): boolean {
  // Common private IP ranges
  const privateRanges = [
    '192.168.0.0/16',   // 192.168.x.x
    '10.0.0.0/8',       // 10.x.x.x
    '172.16.0.0/12',    // 172.16.x.x - 172.31.x.x
  ]
  
  return privateRanges.some(range => 
    isIPInCIDR(ip1, range) && isIPInCIDR(ip2, range)
  )
}

/**
 * Check if an IP is a private IP address
 */
export function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    '192.168.0.0/16',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '127.0.0.0/8',      // Loopback
  ]
  
  return privateRanges.some(range => isIPInCIDR(ip, range))
}

/**
 * Get the likely subnet for an IP address
 * Returns the most specific private subnet or null
 */
export function getSubnet(ip: string): string | null {
  const subnets = [
    { cidr: '192.168.0.0/16', pattern: /^192\.168\./ },
    { cidr: '10.0.0.0/8', pattern: /^10\./ },
    { cidr: '172.16.0.0/12', pattern: /^172\.(1[6-9]|2[0-9]|3[01])\./ },
  ]
  
  for (const { cidr, pattern } of subnets) {
    if (pattern.test(ip)) {
      // Return /24 subnet for 192.168.x.x
      if (cidr === '192.168.0.0/16') {
        const parts = ip.split('.')
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
      }
      return cidr
    }
  }
  
  return null
}