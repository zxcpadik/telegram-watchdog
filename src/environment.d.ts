declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TELEGRAM_BOT_TOKEN: string | undefined;
            DB_CONNECT: string | undefined;
            BOT_AUTH: string | undefined;
            TG_API_ID: number | undefined;
            TG_API_HASH: string | undefined;
            SKIP_ENV_CHECK: string | undefined;
            CHECK_INTERVAL: number | undefined;
        }
    }
}

export { }