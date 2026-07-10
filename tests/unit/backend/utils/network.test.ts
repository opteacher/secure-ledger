/**
 * 网络工具函数测试
 * 测试所有导出的纯函数：getLocalIPs, isValidIP, isValidCIDR, isIPInCIDR,
 * normalizeToCIDR, areInSameSubnet, isPrivateIP, getSubnet
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getLocalIPs,
  isValidIP,
  isValidCIDR,
  isIPInCIDR,
  normalizeToCIDR,
  areInSameSubnet,
  isPrivateIP,
  getSubnet,
} from '../../../../electron/backend/utils/network'

// Mock os.networkInterfaces for getLocalIPs tests
vi.mock('os', () => ({
  networkInterfaces: vi.fn(),
}))

import { networkInterfaces } from 'os'

describe('getLocalIPs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应返回所有非内部 IPv4 地址', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      eth0: [
        { address: '192.168.1.100', family: 'IPv4', internal: false },
        { address: 'fe80::1', family: 'IPv6', internal: false },
      ],
      lo: [
        { address: '127.0.0.1', family: 'IPv4', internal: true },
      ],
      wlan0: [
        { address: '10.0.0.5', family: 'IPv4', internal: false },
      ],
    })

    const result = getLocalIPs()
    expect(result).toEqual(['192.168.1.100', '10.0.0.5'])
  })

  it('无网络接口时应返回空数组', () => {
    vi.mocked(networkInterfaces).mockReturnValue({})

    const result = getLocalIPs()
    expect(result).toEqual([])
  })

  it('应过滤掉 IPv6 地址', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      eth0: [
        { address: '::1', family: 'IPv6', internal: false },
        { address: 'fe80::abcd', family: 'IPv6', internal: false },
      ],
    })

    const result = getLocalIPs()
    expect(result).toEqual([])
  })

  it('应过滤掉内部接口地址', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      lo: [
        { address: '127.0.0.1', family: 'IPv4', internal: true },
        { address: '192.168.1.1', family: 'IPv4', internal: true },
      ],
    })

    const result = getLocalIPs()
    expect(result).toEqual([])
  })

  it('某个接口的 netInfos 为 undefined 时应跳过', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      eth0: undefined as any,
      wlan0: [
        { address: '10.0.0.1', family: 'IPv4', internal: false },
      ],
    })

    const result = getLocalIPs()
    expect(result).toEqual(['10.0.0.1'])
  })
})

describe('isValidIP', () => {
  it('合法的 IPv4 地址应返回 true', () => {
    expect(isValidIP('192.168.1.1')).toBe(true)
    expect(isValidIP('0.0.0.0')).toBe(true)
    expect(isValidIP('255.255.255.255')).toBe(true)
    expect(isValidIP('10.0.0.1')).toBe(true)
    expect(isValidIP('127.0.0.1')).toBe(true)
    expect(isValidIP('1.1.1.1')).toBe(true)
  })

  it('非法的 IP 地址应返回 false', () => {
    expect(isValidIP('256.1.1.1')).toBe(false)
    expect(isValidIP('192.168.1.256')).toBe(false)
    expect(isValidIP('192.168.1')).toBe(false)
    expect(isValidIP('192.168.1.1.1')).toBe(false)
    expect(isValidIP('abc.def.ghi.jkl')).toBe(false)
    expect(isValidIP('')).toBe(false)
    expect(isValidIP('-1.0.0.0')).toBe(false)
    expect(isValidIP('1.2.3.-1')).toBe(false)
  })

  it('包含非法字符的 IP 应返回 false', () => {
    expect(isValidIP('192.168.1.abc')).toBe(false)
    expect(isValidIP('a.b.c.d')).toBe(false)
    expect(isValidIP('192.168.1.-1')).toBe(false)
  })

  it('部分为空的 IP 应返回 false', () => {
    expect(isValidIP('192..1.1')).toBe(false)
    expect(isValidIP('...')).toBe(false)
  })
})

describe('isValidCIDR', () => {
  it('合法的 CIDR 标记应返回 true', () => {
    expect(isValidCIDR('192.168.1.0/24')).toBe(true)
    expect(isValidCIDR('10.0.0.0/8')).toBe(true)
    expect(isValidCIDR('172.16.0.0/12')).toBe(true)
    expect(isValidCIDR('0.0.0.0/0')).toBe(true)
    expect(isValidCIDR('255.255.255.255/32')).toBe(true)
  })

  it('合法的 IP（不含掩码）应返回 true', () => {
    expect(isValidCIDR('192.168.1.1')).toBe(true)
  })

  it('掩码超出范围应返回 false', () => {
    expect(isValidCIDR('192.168.1.0/33')).toBe(false)
    expect(isValidCIDR('192.168.1.0/-1')).toBe(false)
    expect(isValidCIDR('192.168.1.0/999')).toBe(false)
  })

  it('IP 地址非法应返回 false', () => {
    expect(isValidCIDR('256.1.1.1/24')).toBe(false)
    expect(isValidCIDR('abc/24')).toBe(false)
  })

  it('非法格式应返回 false', () => {
    expect(isValidCIDR('/24')).toBe(false)
    expect(isValidCIDR('192.168.1.0/')).toBe(false)
    expect(isValidCIDR('192.168.1.0/abc')).toBe(false)
    expect(isValidCIDR('')).toBe(false)
  })
})

describe('isIPInCIDR', () => {
  it('IP 在 CIDR 范围内应返回 true', () => {
    expect(isIPInCIDR('192.168.1.100', '192.168.1.0/24')).toBe(true)
    expect(isIPInCIDR('10.0.0.50', '10.0.0.0/8')).toBe(true)
    expect(isIPInCIDR('172.16.5.10', '172.16.0.0/12')).toBe(true)
    expect(isIPInCIDR('192.168.1.1', '192.168.1.0/29')).toBe(true)
  })

  it('IP 不在 CIDR 范围内应返回 false', () => {
    expect(isIPInCIDR('192.168.2.100', '192.168.1.0/24')).toBe(false)
    expect(isIPInCIDR('11.0.0.50', '10.0.0.0/8')).toBe(false)
    expect(isIPInCIDR('172.32.0.1', '172.16.0.0/12')).toBe(false)
  })

  it('边界值测试', () => {
    // /24 网络地址和广播地址
    expect(isIPInCIDR('192.168.1.0', '192.168.1.0/24')).toBe(true)
    expect(isIPInCIDR('192.168.1.255', '192.168.1.0/24')).toBe(true)
    // 恰好超出范围
    expect(isIPInCIDR('192.168.2.0', '192.168.1.0/24')).toBe(false)
  })

  it('CIDR 为单 IP 格式（不含 /）应自动补充 /32', () => {
    expect(isIPInCIDR('192.168.1.1', '192.168.1.1')).toBe(true)
    expect(isIPInCIDR('192.168.1.2', '192.168.1.1')).toBe(false)
  })

  it('掩码为 /0 时任何 IP 都应匹配', () => {
    expect(isIPInCIDR('192.168.1.1', '0.0.0.0/0')).toBe(true)
    expect(isIPInCIDR('255.255.255.255', '0.0.0.0/0')).toBe(true)
    expect(isIPInCIDR('10.0.0.1', '0.0.0.0/0')).toBe(true)
  })

  it('掩码为 /32 时只匹配精确 IP', () => {
    expect(isIPInCIDR('192.168.1.1', '192.168.1.1/32')).toBe(true)
    expect(isIPInCIDR('192.168.1.2', '192.168.1.1/32')).toBe(false)
  })

  it('非法的 IP 应返回 false', () => {
    expect(isIPInCIDR('invalid', '192.168.1.0/24')).toBe(false)
    expect(isIPInCIDR('192.168.1.1', 'invalid/24')).toBe(false)
    expect(isIPInCIDR('', '192.168.1.0/24')).toBe(false)
  })

  it('掩码无效时应返回 false', () => {
    expect(isIPInCIDR('192.168.1.1', '192.168.1.0/33')).toBe(false)
    expect(isIPInCIDR('192.168.1.1', '192.168.1.0/-5')).toBe(false)
  })
})

describe('normalizeToCIDR', () => {
  it('已是 CIDR 格式应原样返回', () => {
    expect(normalizeToCIDR('192.168.1.0/24')).toBe('192.168.1.0/24')
    expect(normalizeToCIDR('10.0.0.0/8')).toBe('10.0.0.0/8')
  })

  it('单 IP 应自动添加 /32 后缀', () => {
    expect(normalizeToCIDR('192.168.1.1')).toBe('192.168.1.1/32')
    expect(normalizeToCIDR('10.0.0.1')).toBe('10.0.0.1/32')
    expect(normalizeToCIDR('0.0.0.0')).toBe('0.0.0.0/32')
  })

  it('已有多个斜杠的格式应保持原样', () => {
    expect(normalizeToCIDR('192.168.1.0/24/extra')).toBe('192.168.1.0/24/extra')
  })
})

describe('isPrivateIP', () => {
  it('192.168.x.x 应为私有地址', () => {
    expect(isPrivateIP('192.168.0.1')).toBe(true)
    expect(isPrivateIP('192.168.1.100')).toBe(true)
    expect(isPrivateIP('192.168.255.255')).toBe(true)
  })

  it('10.x.x.x 应为私有地址', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true)
    expect(isPrivateIP('10.255.255.255')).toBe(true)
    expect(isPrivateIP('10.10.10.10')).toBe(true)
  })

  it('172.16.x.x - 172.31.x.x 应为私有地址', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true)
    expect(isPrivateIP('172.20.100.100')).toBe(true)
    expect(isPrivateIP('172.31.255.255')).toBe(true)
  })

  it('127.x.x.x（回环地址）应为私有地址', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true)
    expect(isPrivateIP('127.255.255.255')).toBe(true)
  })

  it('公网 IP 应返回 false', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false)
    expect(isPrivateIP('1.1.1.1')).toBe(false)
    expect(isPrivateIP('203.0.113.5')).toBe(false)
  })

  it('172.15.x.x 不在 /12 范围内，应为公网', () => {
    expect(isPrivateIP('172.15.0.1')).toBe(false)
  })

  it('172.32.x.x 不在 /12 范围内，应为公网', () => {
    expect(isPrivateIP('172.32.0.1')).toBe(false)
  })
})

describe('areInSameSubnet', () => {
  it('两个 IP 都在同一私有子网内应返回 true', () => {
    expect(areInSameSubnet('192.168.1.10', '192.168.1.20')).toBe(true)
    expect(areInSameSubnet('192.168.1.1', '192.168.100.1')).toBe(true)
    expect(areInSameSubnet('10.0.0.1', '10.255.255.254')).toBe(true)
    expect(areInSameSubnet('172.16.0.1', '172.31.255.254')).toBe(true)
  })

  it('跨私有子网的 IP 应返回 true（只要都在某个私有范围内）', () => {
    // 两个 IP 分别在 192.168 和 10.x 范围，但仍都在各自私有范围内
    expect(areInSameSubnet('192.168.1.1', '10.0.0.1')).toBe(false)
  })

  it('一个私有 IP 和一个公网 IP 应返回 false', () => {
    expect(areInSameSubnet('192.168.1.1', '8.8.8.8')).toBe(false)
  })

  it('两个公网 IP 应返回 false', () => {
    expect(areInSameSubnet('8.8.8.8', '1.1.1.1')).toBe(false)
  })

  it('172.16.0.1 和 10.0.0.1 不在同一私有范围', () => {
    expect(areInSameSubnet('172.16.0.1', '10.0.0.1')).toBe(false)
  })

  it('非法的 IP 传入应返回 false', () => {
    expect(areInSameSubnet('invalid', '192.168.1.1')).toBe(false)
    expect(areInSameSubnet('192.168.1.1', 'invalid')).toBe(false)
  })
})

describe('getSubnet', () => {
  it('192.168.x.x 应返回 /24 子网', () => {
    expect(getSubnet('192.168.1.100')).toBe('192.168.1.0/24')
    expect(getSubnet('192.168.0.1')).toBe('192.168.0.0/24')
    expect(getSubnet('192.168.255.1')).toBe('192.168.255.0/24')
  })

  it('10.x.x.x 应返回 /8 范围', () => {
    expect(getSubnet('10.0.0.1')).toBe('10.0.0.0/8')
    expect(getSubnet('10.255.255.255')).toBe('10.0.0.0/8')
    expect(getSubnet('10.10.10.10')).toBe('10.0.0.0/8')
  })

  it('172.16-31.x.x 应返回 /12 范围', () => {
    expect(getSubnet('172.16.0.1')).toBe('172.16.0.0/12')
    expect(getSubnet('172.20.100.100')).toBe('172.16.0.0/12')
    expect(getSubnet('172.31.255.254')).toBe('172.16.0.0/12')
  })

  it('非私有 IP 应返回 null', () => {
    expect(getSubnet('8.8.8.8')).toBeNull()
    expect(getSubnet('1.1.1.1')).toBeNull()
    expect(getSubnet('203.0.113.5')).toBeNull()
  })

  it('172.15.x.x（不在 /12 范围内）应返回 null', () => {
    expect(getSubnet('172.15.0.1')).toBeNull()
  })

  it('172.32.x.x（不在 /12 范围内）应返回 null', () => {
    expect(getSubnet('172.32.0.1')).toBeNull()
  })

  it('包含回环地址应返回 null（不在预定义子网中）', () => {
    expect(getSubnet('127.0.0.1')).toBeNull()
  })
})
