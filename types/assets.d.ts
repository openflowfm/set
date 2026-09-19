// Ambient declarations for the non-code modules the apps import.
//
// Vite turns `import './x.css'` into a side effect that injects the stylesheet.
// There is no value to bind and nothing to type, and TypeScript 5 let such an
// import resolve to nothing without complaint. TypeScript 7 does not (TS2882),
// so the shape has to be written down. Here rather than via `vite/client`,
// which would also declare an `import.meta.env` this repo never reads.

declare module '*.css' {}
