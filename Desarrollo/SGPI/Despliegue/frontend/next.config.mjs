/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async redirects() {
    return [
      {
        source: '/SGPI-CFAC/:path*',
        destination: '/convocatorias/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFB/:path*',
        destination: '/busqueda/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFGI/:path*',
        destination: '/grupos/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFIM/:path*',
        destination: '/importacion/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFIS/:path*',
        destination: '/auth/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFMH/:path*',
        destination: '/investigadores/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFPI/:path*',
        destination: '/proyectos/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFPT/:path*',
        destination: '/publicaciones/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFR/:path*',
        destination: '/reportes/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFSA/:path*',
        destination: '/configuracion/:path*',
        permanent: true,
      },
      {
        source: '/SGPI-CFSF/:path*',
        destination: '/sincronizacion/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/convocatorias/:path*',
        destination: '/SGPI-CFAC/:path*',
      },
      {
        source: '/busqueda/:path*',
        destination: '/SGPI-CFB/:path*',
      },
      {
        source: '/grupos/:path*',
        destination: '/SGPI-CFGI/:path*',
      },
      {
        source: '/importacion/:path*',
        destination: '/SGPI-CFIM/:path*',
      },
      {
        source: '/auth/:path*',
        destination: '/SGPI-CFIS/:path*',
      },
      {
        source: '/investigadores/:path*',
        destination: '/SGPI-CFMH/:path*',
      },
      {
        source: '/proyectos/:path*',
        destination: '/SGPI-CFPI/:path*',
      },
      {
        source: '/publicaciones/:path*',
        destination: '/SGPI-CFPT/:path*',
      },
      {
        source: '/reportes/:path*',
        destination: '/SGPI-CFR/:path*',
      },
      {
        source: '/configuracion/:path*',
        destination: '/SGPI-CFSA/:path*',
      },
      {
        source: '/sincronizacion/:path*',
        destination: '/SGPI-CFSF/:path*',
      },
    ];
  },
};

export default nextConfig;
