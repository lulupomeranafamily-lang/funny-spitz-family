import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { google } from "googleapis";

const CONFIG_DIR = path.resolve("config");
const DRIVE_DIR = "G:\\Meu Drive\\Funny Spitz Family";
const TOKEN_PATH = path.join(CONFIG_DIR, "youtube_token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube"
];

/**
 * Procura automaticamente o arquivo client_secret*.json na pasta config/
 * ou direto na pasta G:\Meu Drive\Funny Spitz Family
 */
function findCredentialsFile() {
  const searchDirs = [CONFIG_DIR, DRIVE_DIR];
  for (const dir of searchDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      const match = files.find(
        (f) =>
          f.toLowerCase().startsWith("client_secret") &&
          f.toLowerCase().endsWith(".json")
      );
      if (match) {
        return path.join(dir, match);
      }
    } catch {
      // ignora erro de permissão se ocorrer
    }
  }
  return path.join(CONFIG_DIR, "client_secret.json");
}

/**
 * Garante que o horário agendado (publishAt) esteja no futuro (requisito da YouTube API).
 * Se o horário de hoje já passou (ex: 07:00 quando já são 15:00), agenda para as 07:00 do dia seguinte.
 */
function ensureFuturePublishAt(isoString) {
  if (!isoString) return null;
  const target = new Date(isoString);
  const nowPlus10Min = new Date(Date.now() + 10 * 60 * 1000);
  if (target <= nowPlus10Min) {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString();
}

/**
 * Carrega cliente OAuth2 autenticado para YouTube Data API v3
 */
export async function getAuthenticatedClient() {
  // Suporte para execução 100% em Nuvem (GitHub Actions Secrets)
  if (process.env.YOUTUBE_CLIENT_SECRET_JSON && process.env.YOUTUBE_TOKEN_JSON) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const envCredsPath = path.join(CONFIG_DIR, "client_secret.json");
    if (!fs.existsSync(envCredsPath)) {
      fs.writeFileSync(envCredsPath, process.env.YOUTUBE_CLIENT_SECRET_JSON, "utf-8");
    }
    if (!fs.existsSync(TOKEN_PATH)) {
      fs.writeFileSync(TOKEN_PATH, process.env.YOUTUBE_TOKEN_JSON, "utf-8");
    }
  }

  const credentialsPath = findCredentialsFile();
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Arquivo client_secret.json não encontrado!\n` +
        `Salve o JSON OAuth 2.0 na sua pasta "G:\\Meu Drive\\Funny Spitz Family" ou em "${CONFIG_DIR}\\client_secret.json".`
    );
  }

  const raw = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  const creds = raw.installed || raw.web;
  if (!creds) {
    throw new Error(
      `Formato inválido em ${credentialsPath}. Certifique-se de baixar um ID do cliente OAuth 2.0 (App para Computador / Desktop).`
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    "http://localhost:48888/oauth2callback"
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    oauth2Client.setCredentials(token);
    return oauth2Client;
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES
  });

  console.log("\n========================================================");
  console.log("🔑 AUTORIZAÇÃO DO YOUTUBE (NECESSÁRIA APENAS 1 VEZ)");
  console.log("Abra este link no navegador e selecione o canal @FunnySpitzFamily:");
  console.log(authUrl);
  console.log("========================================================\n");

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url, "http://localhost:48888");
      const authCode = urlObj.searchParams.get("code");
      if (authCode) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h2>✅ Canal Funny Spitz Family conectado com sucesso! Você já pode fechar esta janela e voltar ao Antigravity.</h2>"
        );
        server.close();
        resolve(authCode);
      } else {
        res.writeHead(400);
        res.end("Código não encontrado.");
      }
    });
    server.listen(48888, () => {
      console.log(
        "Aguardando confirmação em http://localhost:48888/oauth2callback ..."
      );
      try {
        spawn("cmd", ["/c", "start", "", authUrl], {
          detached: true,
          stdio: "ignore"
        }).unref();
      } catch {
        // Caso não abra automaticamente, o link já está impresso no console
      }
    });
    server.on("error", reject);
  });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
  console.log(
    `✅ Token salvo em ${TOKEN_PATH}! Os próximos uploads serão 100% automáticos.`
  );
  return oauth2Client;
}

/**
 * Faz upload de um vídeo para o YouTube com agendamento de horário, SEO completo e flag de mídia sintética
 */
export async function uploadVideoToYouTube({
  videoPath,
  thumbnailPath,
  title,
  description,
  tags,
  defaultLanguage = "pt-BR",
  publishAtIso = null,
  madeForKids = true
}) {
  const auth = await getAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth });

  const validPublishAt = ensureFuturePublishAt(publishAtIso);

  const statusObj = {
    privacyStatus: validPublishAt ? "private" : "public",
    selfDeclaredMadeForKids: madeForKids,
    containsSyntheticMedia: true
  };
  if (validPublishAt) {
    statusObj.publishAt = validPublishAt;
  }

  console.log(
    `🚀 Enviando vídeo para o YouTube: "${title}" (Agendado para: ${
      validPublishAt || "Imediato"
    })...`
  );
  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: "24", // Entertainment / Family
        defaultLanguage,
        defaultAudioLanguage: defaultLanguage
      },
      status: statusObj
    },
    media: {
      body: fs.createReadStream(videoPath)
    }
  });

  const videoId = response.data.id;
  const isWidescreen = videoPath.toLowerCase().includes("16x9");
  const videoUrl = isWidescreen
    ? `https://www.youtube.com/watch?v=${videoId}`
    : `https://www.youtube.com/shorts/${videoId}`;
  console.log(`✅ Upload concluído! ID: ${videoId} | URL: ${videoUrl}`);

  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          body: fs.createReadStream(thumbnailPath)
        }
      });
      console.log(`🖼️ Thumbnail aplicada com sucesso ao vídeo ${videoId}!`);
    } catch (thumbErr) {
      console.warn(
        `⚠️ Aviso ao aplicar thumbnail customizada (o canal pode precisar de verificação por telefone no YouTube Studio): ${thumbErr.message}`
      );
    }
  }

  return {
    videoId,
    url: videoUrl,
    publishAt: validPublishAt,
    status: validPublishAt ? "agendado" : "publicado"
  };
}

// Execução direta via CLI: envia os 2 vídeos (PT e EN) do relatório
if (process.argv[1] && process.argv[1].endsWith("youtube-upload.js")) {
  const reportPath =
    process.argv[2] || path.resolve("episodes/ep03/output/relatorio_ciclo.json");
  const epJsonPath =
    process.argv[3] || path.resolve("episodes/ep03/ep03.json");

  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const epData = JSON.parse(fs.readFileSync(epJsonPath, "utf-8"));

  for (const vid of report.videos) {
    const langKey = vid.idioma.startsWith("pt") ? "pt" : "en";
    const seo = epData.seo[langKey];
    const result = await uploadVideoToYouTube({
      videoPath: vid.arquivo_video,
      thumbnailPath: vid.arquivo_thumbnail,
      title: seo.selectedTitle,
      description: seo.description,
      tags: seo.tags,
      defaultLanguage: vid.idioma,
      publishAtIso: vid.horario_publicacao,
      madeForKids: true
    });
    vid.video_id = result.videoId;
    vid.url = result.url;
    vid.horario_publicacao = result.publishAt || vid.horario_publicacao;
    vid.status = result.status;
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log("📋 Relatório atualizado com os IDs e URLs do YouTube!");
}
