// Code 128 (Code Set B) encoder — pure TypeScript, no dependencies.
// Web's BarcodePreview uses jsbarcode (a browser/DOM library, not portable
// to React Native); rather than pull in a barcode-rendering package whose
// published versions pin react-native-svg to an older exact version than
// this app already uses (a real native-module version conflict risk),
// this hand-rolled encoder renders through the react-native-svg the app
// already depends on. Code Set B covers ASCII 32-126 — every realistic
// SKU/barcode string — so this intentionally does not implement true
// EAN13 symbology for 13-digit values the way web does; the value is
// still fully scannable, just not in retail-UPC form.
//
// Width table and weighted mod-103 checksum per the published Code 128
// standard (ISO/IEC 15417) — verified against the canonical symbol table
// rather than recalled from memory, since a single wrong digit here would
// silently produce a barcode that looks fine but doesn't scan.
const WIDTHS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131",
  "211412", "211214", "211232", // 103 START A, 104 START B, 105 START C
  "2331112", // 106 STOP
];

const START_B = 104;
const STOP = 106;

// Returns a flat sequence of module widths (bar, space, bar, space, …,
// starting and ending with a bar) — or null if the value contains a
// character outside Code Set B's ASCII 32-126 range.
export function encodeCode128B(value: string): number[] | null {
  if (!value) return null;
  const symbolValues: number[] = [START_B];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code > 126) return null;
    symbolValues.push(code - 32);
  }
  let checksum = symbolValues[0];
  for (let i = 1; i < symbolValues.length; i++) checksum += symbolValues[i] * i;
  symbolValues.push(checksum % 103);
  symbolValues.push(STOP);

  const widths: number[] = [];
  for (const v of symbolValues) {
    for (const digit of WIDTHS[v]) widths.push(Number(digit));
  }
  return widths;
}
