export const BYTESCALE_CONFIG = {
  admin: {
    ACCOUNT_ID: "kW2K8hR",
    PUBLIC_KEY: "public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ",
    // ❌ DO NOT put secret keys here
    SECRET_KEY_ENV: "BYTESCALE_SECRET_KEY_ADMIN", // just the ENV NAME, not the key
    API_KEY_ID_ENV: "BYTESCALE_API_KEY_ID_ADMIN", // ⬅️ Environment variable for API Key ID
    HMAC_KEY_ENV: "BYTESCALE_HMAC_KEY_ADMIN" // ⬅️ Environment variable for HMAC Key
  },
  member: { //Same for now
    ACCOUNT_ID: "kW2K8hR",
    PUBLIC_KEY: "public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ",
    // ❌ DO NOT put secret keys here
    SECRET_KEY_ENV: "BYTESCALE_SECRET_KEY_ADMIN", // just the ENV NAME, not the key
    API_KEY_ID_ENV: "BYTESCALE_API_KEY_ID_ADMIN", // ⬅️ Environment variable for API Key ID
    HMAC_KEY_ENV: "BYTESCALE_HMAC_KEY_ADMIN" // ⬅️ Environment variable for HMAC Key
  }
};