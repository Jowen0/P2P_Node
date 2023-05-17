import { CLOSE_CODE } from "../const"

export type Data = {
    type: string,
    data: any
} & Record<string, unknown>

export type CloseCode = typeof CLOSE_CODE[keyof typeof CLOSE_CODE]