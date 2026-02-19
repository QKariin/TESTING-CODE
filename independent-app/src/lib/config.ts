// src/lib/config.ts
export const BYTESCALE_CONFIG: Record<string, {
    ACCOUNT_ID: string;
    PUBLIC_KEY: string;
    SECRET_KEY_ENV: string;
    API_KEY_ID_ENV: string;
    HMAC_KEY_ENV: string;
}> = {
    admin: {
        ACCOUNT_ID: "kW2K8hR",
        PUBLIC_KEY: "public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ",
        SECRET_KEY_ENV: "BYTESCALE_SECRET_KEY_ADMIN",
        API_KEY_ID_ENV: "BYTESCALE_API_KEY_ID_ADMIN",
        HMAC_KEY_ENV: "BYTESCALE_HMAC_KEY_ADMIN"
    },
    member: {
        ACCOUNT_ID: "kW2K8hR",
        PUBLIC_KEY: "public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ",
        SECRET_KEY_ENV: "BYTESCALE_SECRET_KEY_ADMIN",
        API_KEY_ID_ENV: "BYTESCALE_API_KEY_ID_ADMIN",
        HMAC_KEY_ENV: "BYTESCALE_HMAC_KEY_ADMIN"
    }
};
