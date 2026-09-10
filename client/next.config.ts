import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `next dev` otherwise writes an AGENTS.md and a CLAUDE.md into this package on every boot.
   * The repository already has one architecture contract at the root, and a second CLAUDE.md
   * nested under `client/` shadows it. The Next 16 specifics that file warns about — Promise
   * params, `proxy.ts`, Turbopack — are already written down there.
   */
  agentRules: false,
};

export default nextConfig;
