/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/vipaccess',
        destination: '/VIPaccess',
        permanent: true,
      },
      {
        source: '/Vipaccess',
        destination: '/VIPaccess',
        permanent: true,
      },
      {
        source: '/vIPaccess',
        destination: '/VIPaccess',
        permanent: true,
      },
      {
        source: '/VIPACCESS',
        destination: '/VIPaccess',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
