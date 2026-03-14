/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
