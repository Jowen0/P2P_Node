export const CLOSE_CODE = {
    RERENDER: 0
} as const;

export const CLOSE_REASON = {
    [CLOSE_CODE.RERENDER]: 'Rerender'
} as const;