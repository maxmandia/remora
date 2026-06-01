import { twMerge } from 'tailwind-merge'

type ClassDictionary = Record<string, unknown>
export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassDictionary
  | ClassValue[]

function toClassName(input: ClassValue): string {
  if (!input) {
    return ''
  }

  if (
    typeof input === 'string' ||
    typeof input === 'number' ||
    typeof input === 'bigint'
  ) {
    return String(input)
  }

  if (Array.isArray(input)) {
    return input.map(toClassName).filter(Boolean).join(' ')
  }

  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, value]) => Boolean(value))
      .map(([className]) => className)
      .join(' ')
  }

  return ''
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(inputs.map(toClassName).filter(Boolean).join(' '))
}
