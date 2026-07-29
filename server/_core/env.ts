export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openAiApiUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiDefaultModel: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4o-mini",
  notificationApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  notificationApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
