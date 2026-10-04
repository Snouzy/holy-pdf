declare module "@wasm-zoo/qpdf/qpdf-core.js" {
  export type QpdfCore = {
    FS: {
      writeFile(path: string, bytes: Uint8Array): void;
      readFile(path: string): Uint8Array;
      stat(path: string): { size: number };
      unlink(path: string): void;
    };
    callMain(args: string[]): number;
  };

  export type QpdfCoreOptions = {
    locateFile: (name: string) => string;
    noInitialRun: boolean;
    print: (message: string) => void;
    printErr: (message: string) => void;
    wasmBinary?: Uint8Array;
  };

  export default function createQpdfCore(options: QpdfCoreOptions): Promise<QpdfCore>;
}
