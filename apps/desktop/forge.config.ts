import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerZIP } from '@electron-forge/maker-zip'
import { VitePlugin } from '@electron-forge/plugin-vite'
import path from 'node:path'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: [path.resolve(__dirname, 'assets/icon.png')],
    icon: path.resolve(__dirname, 'assets/icon'),
    protocols: [
      {
        name: 'Remora',
        schemes: ['app.remora.desktop'],
      },
    ],
  },
  makers: [new MakerZIP({}, ['darwin'])],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
}

export default config
