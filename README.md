# 🐾 Funny Spitz Family — Automação 100% em Nuvem (GitHub Actions)

Sistema completo de geração, edição e publicação automática diária para o canal **[@FunnySpitzFamily](https://www.youtube.com/@FunnySpitzFamily)** (Português + Inglês), que roda **100% na nuvem com o seu computador desligado**.

---

## ☁️ Como Ativar no GitHub Actions (Custo R$ 0)

1. **Crie um Repositório Privado no GitHub:**
   * Acesse https://github.com/new e crie um repositório privado chamado `funny-spitz-family` e suba os arquivos desta pasta (`C:\Users\vinic\.gemini\antigravity\scratch\funny-spitz-family`).

2. **Adicione os 3 Secrets no Repositório:**
   * No seu repositório no GitHub, vá em **Settings > Secrets and variables > Actions > New repository secret** e crie estes 3 segredos:
     1. `GEMINI_API_KEY`: Sua chave gratuita do [Google AI Studio](https://aistudio.google.com/apikey) (clique em *Create API Key*).
     2. `YOUTUBE_CLIENT_SECRET_JSON`: Abra o seu arquivo `config/client_secret_*.json` no Bloco de Notas, copie todo o texto JSON e cole aqui.
     3. `YOUTUBE_TOKEN_JSON`: Abra o arquivo `config/youtube_token.json` gerado hoje no Bloco de Notas, copie todo o texto JSON e cole aqui.

3. **Pronto! Como funciona a execução diária:**
   * O workflow [`.github/workflows/daily-youtube-shorts.yml`](file:///C:/Users/vinic/.gemini/antigravity/scratch/funny-spitz-family/.github/workflows/daily-youtube-shorts.yml) liga automaticamente todo dia às **05:00 da manhã (Horário de Brasília)** nos servidores do GitHub.
   * Ele executa [`src/cloud-cycle.js`](file:///C:/Users/vinic/.gemini/antigravity/scratch/funny-spitz-family/src/cloud-cycle.js), que:
     1. Consulta [`config/history.json`](file:///C:/Users/vinic/.gemini/antigravity/scratch/funny-spitz-family/config/history.json) para nunca repetir temas.
     2. Cria o roteiro bilíngue inédito da **Raven, Vlad, Luna, Theo e Jonny**.
     3. Gera as imagens `9:16` em alta definição.
     4. Produz as vozes neurais (incluindo a voz grave de alfa do Vlad) e renderiza os 2 vídeos (PT e EN) com música de fundo.
     5. Envia para o YouTube agendando o vídeo 1 para as **07:00** e o vídeo 2 para as **18:00**.
     6. Salva o novo tema em `config/history.json`.
