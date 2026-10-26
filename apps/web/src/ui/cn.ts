import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins classes; a later Tailwind class wins over an earlier one for the same property. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
