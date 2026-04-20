export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const isPrivyConfigured = PRIVY_APP_ID.length > 0;
