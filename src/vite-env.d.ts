/// <reference types="vite/client" />

declare module '*.css';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ion-icon': any;
    }
  }
}
