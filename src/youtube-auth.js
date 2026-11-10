import { getAuthenticatedClient } from "./youtube-upload.js";
import { google } from "googleapis";

/**
 * Script de autenticação única do canal @FunnySpitzFamily
 */
try {
  const auth = await getAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });
  const res = await youtube.channels.list({
    part: ["snippet", "statistics"],
    mine: true
  });

  const channel = res.data.items?.[0];
  if (channel) {
    console.log("\n========================================================");
    console.log(`🎉 CONECTADO COM SUCESSO AO CANAL DO YOUTUBE!`);
    console.log(`📺 Canal: ${channel.snippet.title} (${channel.snippet.customUrl || channel.id})`);
    console.log(`👥 Inscritos: ${channel.statistics.subscriberCount || "0"}`);
    console.log(`🎬 Vídeos publicados: ${channel.statistics.videoCount || "0"}`);
    console.log("========================================================\n");
  } else {
    console.log("✅ Autenticado com sucesso, mas nenhum canal foi retornado para esta conta.");
  }
} catch (err) {
  console.error("\n❌ Erro na autenticação:", err.message);
  process.exit(1);
}
