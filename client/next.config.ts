import type { NextConfig } from 'next';
import { env } from './src/lib/env';
import { MAX_IMAGE_UPLOAD_BYTES, UPLOADED_MEDIA_PATH } from './src/lib/constants';

const nextConfig: NextConfig = {
  /**
   * `next dev` otherwise writes an AGENTS.md and a CLAUDE.md into this package on every boot.
   * The repository already has one architecture contract at the root, and a second CLAUDE.md
   * nested under `client/` shadows it. The Next 16 specifics that file warns about — Promise
   * params, `proxy.ts`, Turbopack — are already written down there.
   */
  agentRules: false,

  experimental: {
    /**
     * Admin image uploads go through a Server Action, whose default body cap is 1 MB — smaller
     * than most phone photos. The API compresses whatever arrives, so this only has to admit the
     * API's own limit plus the multipart overhead Next counts against it.
     */
    serverActions: { bodySizeLimit: MAX_IMAGE_UPLOAD_BYTES + 512 * 1024 },
  },

  /**
   * Uploaded images live on the API's disk and are served by it. Proxying the path keeps every
   * stored image URL a same-origin path, so `next/image` treats an upload exactly like a file in
   * `public/` — no remote pattern, no second origin to allow, and a CDN later is a change here.
   */
  async rewrites() {
    return [
      {
        source: `${UPLOADED_MEDIA_PATH}/:path*`,
        destination: `${new URL(env.NEXT_PUBLIC_API_BASE_URL).origin}${UPLOADED_MEDIA_PATH}/:path*`,
      },
    ];
  },
};

export default nextConfig;
