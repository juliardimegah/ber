/** @type {import('next').NextConfig} */
const nextConfig = {
  // Semua route menggunakan nodejs runtime (bcryptjs tidak kompatibel dengan edge runtime)
  // Vercel mendukung keduanya
};

export default nextConfig;
