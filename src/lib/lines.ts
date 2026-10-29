/** Each product category rides its own coloured "line", assigned in a fixed order. */
const PALETTE = [
  { band: "bg-yamabuki", text: "text-yamabuki", stroke: "#f2b300" },
  { band: "bg-ai", text: "text-ai", stroke: "#1e3557" },
  { band: "bg-wakatake", text: "text-wakatake", stroke: "#2f7d52" },
  { band: "bg-fuji", text: "text-fuji", stroke: "#6b5a8e" },
  { band: "bg-shu", text: "text-shu", stroke: "#d23f27" },
  { band: "bg-hanada", text: "text-hanada", stroke: "#2f6f8c" },
];

export function lineColors(categories: string[]) {
  const unique = Array.from(new Set(categories));
  return (c: string) => PALETTE[Math.max(0, unique.indexOf(c)) % PALETTE.length];
}
