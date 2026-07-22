declare module "qr.js/lib/QRCode" {
  export default class QRCode {
    constructor(typeNumber: number, errorCorrectLevel: number);
    modules: boolean[][];
    addData(value: string): void;
    make(): void;
  }
}

declare module "qr.js/lib/ErrorCorrectLevel" {
  const levels: Record<"L" | "M" | "Q" | "H", number>;
  export default levels;
}
