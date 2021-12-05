export function calculateDelay(sendAt: string): number {
    // Don't deliver messages before they should arrive. Opt for up to a second later instead. That's why we ceil here.
    return Math.ceil((new Date(sendAt).getTime() - new Date().getTime()) / 1_000);
}