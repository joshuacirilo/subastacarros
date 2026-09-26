export type User = { id: number; nombre: string; apellido: string };
export type Option = { id: number; nombre: string };
export type Catalogs = {
  marcas: Option[];
  modelos: (Option & { marca_id: number })[];
  tipos: Option[];
  transmisiones: Option[];
  combustibles: Option[];
};
export type AuctionState = {
  id: number;
  base: string;
  highest: string | null;
  minimum: string;
  startsAt: string;
  endsAt: string;
  serverNow: string;
  status: "programada" | "activa" | "cerrada";
  bidCount: number;
  winning: boolean;
  outbid: boolean;
  sold: boolean;
};
export type Auction = {
  id: number;
  vehicleId: number;
  marca: string;
  modelo: string;
  anio: number;
  motor: string;
  tipo: string;
  transmision: string;
  combustible: string;
  tren_manejo: string;
  numero_cilindros: number;
  nivel_dano: string;
  marca_id: number;
  modelo_id: number;
  tipo_articulo_id: number;
  transmision_id: number;
  combustible_id: number;
  photos: string[];
  mine: boolean;
  editable: boolean;
  state: AuctionState;
};
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function moneyCents(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d{1,16}(\.\d{1,2})?$/.test(value))
    throw new AppError("Ingresa un monto válido con hasta dos decimales.");
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (cents <= BigInt(0) || cents > BigInt("999999999999999999"))
    throw new AppError("El monto está fuera del rango permitido.");
  return cents;
}
export function decimal(cents: bigint): string {
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}
export function minimumBid(base: string, highest: string | null): string {
  return highest === null
    ? decimal(moneyCents(base))
    : decimal((moneyCents(highest) * BigInt(110) + BigInt(99)) / BigInt(100));
}
export function guatemalaDate(value: unknown): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  )
    throw new AppError("Ingresa fecha y hora de Guatemala válidas.");
  const date = new Date(value + ":00-06:00");
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() - 6 * 3600000).toISOString().slice(0, 16) !== value
  )
    throw new AppError("La fecha no existe.");
  return date;
}
export function localInput(iso: string): string {
  return new Date(new Date(iso).getTime() - 6 * 3600000)
    .toISOString()
    .slice(0, 16);
}
export function currency(amount: string | null): string {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(Number(amount ?? 0));
}
export function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(new Date(iso));
}
