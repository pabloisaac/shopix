/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['gateway.pinata.cloud', 'ipfs.io'],
  },
  webpack: (config, { dev }) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    }
    // Reducir archivos watcheados en dev para evitar EMFILE en macOS
    if (dev) {
      config.watchOptions = {
        ignored: /node_modules/,
        aggregateTimeout: 300,
      }
    }
    return config
  },
}

module.exports = nextConfig
