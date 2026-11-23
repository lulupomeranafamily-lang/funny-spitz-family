import fs from "node:fs";
import path from "node:path";
import sharp from "file:///C:/Users/vinic/.gemini/antigravity/scratch/funny-spitz-family/node_modules/sharp/lib/index.js";
import {
  generateCleanStageBackground,
  selectCharacterCutoutPath,
  renderLivePuppetSceneClip
} from "file:///C:/Users/vinic/.gemini/antigravity/scratch/funny-spitz-family/src/live-puppet-animator.js";

const repoDir = "C:/Users/vinic/.gemini/antigravity/scratch/funny-spitz-family";
process.chdir(repoDir);

/**
 * Cria adereços visuais 3D em SVG de alta definição específicos para cada cena do Parque de Diversões,
 * para que cada cena mostre exatamente o objeto/ação descrita no roteiro (ingressos dourados, mapa do parque,
 * volante de carrinho bate-bate, espelho dourado de parque, garra mecânica com ursinho dourado, carrinho de pipoca,
 * nuvem gigante de algodão-doce rosa na cabeça do Papai Vlad, cabine de roda-gigante e fogos de artifício)!
 */
function buildScenePropSvg(sceneId, W = 700, H = 780) {
  switch (sceneId) {
    case "01": // Raven segurando os 5 ingressos/pulseiras douradas do parque
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(390, 470) rotate(-14)">
          <rect x="0" y="0" width="220" height="95" rx="14" fill="#FFD700" stroke="#B8860B" stroke-width="5"/>
          <rect x="12" y="12" width="196" height="71" rx="8" fill="none" stroke="#FFF8DC" stroke-width="3" stroke-dasharray="8,6"/>
          <circle cx="55" cy="47" r="22" fill="#FF8C00"/>
          <polygon points="55,30 61,42 74,43 64,52 67,65 55,58 43,65 46,52 36,43 49,42" fill="#FFF"/>
          <rect x="92" y="32" width="95" height="12" rx="6" fill="#8B6508"/>
          <rect x="92" y="54" width="70" height="10" rx="5" fill="#B8860B"/>
        </g>
        <g transform="translate(420, 515) rotate(8)">
          <rect x="0" y="0" width="220" height="95" rx="14" fill="#FFC125" stroke="#8B6508" stroke-width="5"/>
          <circle cx="55" cy="47" r="22" fill="#E63946"/>
          <polygon points="55,30 61,42 74,43 64,52 67,65 55,58 43,65 46,52 36,43 49,42" fill="#FFD700"/>
          <rect x="92" y="34" width="95" height="12" rx="6" fill="#5C4033"/>
          <rect x="92" y="55" width="75" height="10" rx="5" fill="#8B6508"/>
        </g>
      </svg>`);
    case "03": // Theo segurando o mapa ilustrado colorido do parque de diversões
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(150, 490)">
          <rect x="0" y="0" width="400" height="230" rx="16" fill="#FFF8E7" stroke="#D4A373" stroke-width="8"/>
          <path d="M 35 175 Q 120 45 210 150 T 365 70" fill="none" stroke="#E63946" stroke-width="8" stroke-dasharray="12,8"/>
          <circle cx="95" cy="95" r="38" fill="none" stroke="#2A9D8F" stroke-width="6"/>
          <circle cx="95" cy="95" r="8" fill="#E76F51"/>
          <polygon points="270,175 315,85 360,175" fill="#F4A261" stroke="#E76F51" stroke-width="5"/>
          <circle cx="365" cy="70" r="16" fill="#E63946"/>
        </g>
      </svg>`);
    case "06": // Jonny dirigindo o carrinho bate-bate vermelho brilhante
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <path d="M 30 780 Q 80 550 350 550 Q 620 550 670 780 Z" fill="#E63946" stroke="#9B2226" stroke-width="10"/>
        <ellipse cx="350" cy="610" rx="220" ry="45" fill="#2B2D42" stroke="#8D99AE" stroke-width="8"/>
        <circle cx="350" cy="540" r="78" fill="none" stroke="#1D1E2C" stroke-width="22"/>
        <circle cx="350" cy="540" r="24" fill="#FFB703"/>
        <line x1="350" y1="540" x2="350" y2="618" stroke="#1D1E2C" stroke-width="20"/>
        <circle cx="135" cy="690" r="32" fill="#FFF3B0" stroke="#FFB703" stroke-width="8"/>
        <circle cx="565" cy="690" r="32" fill="#FFF3B0" stroke="#FFB703" stroke-width="8"/>
      </svg>`);
    case "07": // Vlad preso girando no carrinho bate-bate azul
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <path d="M 30 780 Q 80 550 350 550 Q 620 550 670 780 Z" fill="#1D4ED8" stroke="#1E3A8A" stroke-width="10"/>
        <ellipse cx="350" cy="610" rx="220" ry="45" fill="#1E293B" stroke="#94A3B8" stroke-width="8"/>
        <circle cx="350" cy="540" r="78" fill="none" stroke="#0F172A" stroke-width="22"/>
        <circle cx="350" cy="540" r="24" fill="#38BDF8"/>
        <circle cx="135" cy="690" r="32" fill="#FEF08A" stroke="#F59E0B" stroke-width="8"/>
        <circle cx="565" cy="690" r="32" fill="#FEF08A" stroke="#F59E0B" stroke-width="8"/>
      </svg>`);
    case "08": // Raven dirigindo o carrinho bate-bate roxo rindo
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <path d="M 30 780 Q 80 550 350 550 Q 620 550 670 780 Z" fill="#7C3AED" stroke="#4C1D95" stroke-width="10"/>
        <ellipse cx="350" cy="610" rx="220" ry="45" fill="#1E1B4B" stroke="#C4B5FD" stroke-width="8"/>
        <circle cx="350" cy="540" r="78" fill="none" stroke="#1E1B4B" stroke-width="22"/>
        <circle cx="350" cy="540" r="24" fill="#F472B6"/>
        <circle cx="135" cy="690" r="32" fill="#FEF08A" stroke="#F59E0B" stroke-width="8"/>
        <circle cx="565" cy="690" r="32" fill="#FEF08A" stroke="#F59E0B" stroke-width="8"/>
      </svg>`);
    case "09":
    case "10": // Moldura dourada curvilínea da Sala dos Espelhos Mágicos
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="15" width="660" height="750" rx="65" fill="none" stroke="#F59E0B" stroke-width="26"/>
        <rect x="38" y="33" width="624" height="714" rx="50" fill="none" stroke="#FEF08A" stroke-width="6" stroke-dasharray="18,12"/>
      </svg>`);
    case "11": // Garra mecânica iluminada descendo sobre o ursinho dourado
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <line x1="540" y1="0" x2="540" y2="180" stroke="#94A3B8" stroke-width="14"/>
        <circle cx="540" cy="190" r="26" fill="#F59E0B" stroke="#78350F" stroke-width="6"/>
        <path d="M 515 205 Q 465 265 495 320" fill="none" stroke="#CBD5E1" stroke-width="14" stroke-linecap="round"/>
        <path d="M 565 205 Q 615 265 585 320" fill="none" stroke="#CBD5E1" stroke-width="14" stroke-linecap="round"/>
        <circle cx="540" cy="360" r="55" fill="#FBBF24" stroke="#B45309" stroke-width="6"/>
        <circle cx="498" cy="315" r="22" fill="#FBBF24" stroke="#B45309" stroke-width="5"/>
        <circle cx="582" cy="315" r="22" fill="#FBBF24" stroke="#B45309" stroke-width="5"/>
        <circle cx="522" cy="350" r="7" fill="#1E293B"/>
        <circle cx="558" cy="350" r="7" fill="#1E293B"/>
        <ellipse cx="540" cy="372" rx="16" ry="12" fill="#FEF3C7"/>
        <circle cx="540" cy="368" r="6" fill="#78350F"/>
      </svg>`);
    case "12": // Luna abraçando o ursinho de pelúcia dourado gigante
    case "17": // Vlad cochilando no banco do parque com o ursinho dourado e algodão-doce
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(430, 410)">
          <circle cx="110" cy="180" r="85" fill="#F59E0B" stroke="#B45309" stroke-width="6"/>
          <circle cx="110" cy="85" r="68" fill="#FBBF24" stroke="#B45309" stroke-width="6"/>
          <circle cx="58" cy="35" r="26" fill="#F59E0B" stroke="#B45309" stroke-width="5"/>
          <circle cx="162" cy="35" r="26" fill="#F59E0B" stroke="#B45309" stroke-width="5"/>
          <circle cx="88" cy="75" r="8" fill="#1E293B"/>
          <circle cx="132" cy="75" r="8" fill="#1E293B"/>
          <ellipse cx="110" cy="98" rx="22" ry="16" fill="#FEF3C7"/>
          <circle cx="110" cy="93" r="8" fill="#78350F"/>
          <path d="M 85 142 L 135 142" stroke="#E11D48" stroke-width="14" stroke-linecap="round"/>
        </g>
      </svg>`);
    case "13": // Raven ao lado do balde listrado vermelho e branco cheio de pipoca dourada
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(450, 450)">
          <circle cx="60" cy="40" r="28" fill="#FEF08A"/>
          <circle cx="100" cy="28" r="32" fill="#FDE047"/>
          <circle cx="145" cy="38" r="28" fill="#FEF08A"/>
          <circle cx="80" cy="52" r="26" fill="#FACC15"/>
          <circle cx="125" cy="50" r="26" fill="#FEF08A"/>
          <polygon points="30,55 180,55 155,250 55,250" fill="#FFFFFF" stroke="#DC2626" stroke-width="6"/>
          <polygon points="55,55 85,55 75,250 55,250" fill="#DC2626"/>
          <polygon points="115,55 145,55 135,250 115,250" fill="#DC2626"/>
        </g>
      </svg>`);
    case "14": // Theo olhando de binóculo para a nuvem rosa gigante de algodão-doce
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(430, 80)">
          <circle cx="110" cy="110" r="75" fill="#F472B6" opacity="0.92"/>
          <circle cx="65" cy="125" r="58" fill="#F9A8D4" opacity="0.92"/>
          <circle cx="155" cy="125" r="58" fill="#F9A8D4" opacity="0.92"/>
          <circle cx="110" cy="70" r="55" fill="#FBCFE8" opacity="0.95"/>
        </g>
      </svg>`);
    case "15": // Vlad coberto por uma peruca/nuvem gigante de algodão-doce cor-de-rosa na cabeça!
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(110, 5)">
          <circle cx="240" cy="130" r="115" fill="#F472B6" opacity="0.94"/>
          <circle cx="135" cy="160" r="92" fill="#F9A8D4" opacity="0.94"/>
          <circle cx="345" cy="160" r="92" fill="#F9A8D4" opacity="0.94"/>
          <circle cx="185" cy="85" r="85" fill="#FBCFE8" opacity="0.95"/>
          <circle cx="295" cy="85" r="85" fill="#FBCFE8" opacity="0.95"/>
          <circle cx="240" cy="65" r="75" fill="#FDF2F8" opacity="0.92"/>
        </g>
      </svg>`);
    case "16": // Jonny segurando um algodão-doce cor-de-rosa no palito
      return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 700 780" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(455, 340) rotate(10)">
          <rect x="88" y="140" width="14" height="170" rx="6" fill="#FDE68A" stroke="#D97706" stroke-width="3"/>
          <circle cx="95" cy="100" r="68" fill="#F472B6"/>
          <circle cx="55" cy="115" r="50" fill="#F9A8D4"/>
          <circle cx="135" cy="115" r="50" fill="#F9A8D4"/>
          <circle cx="95" cy="65" r="48" fill="#FBCFE8"/>
        </g>
      </svg>`);
    default:
      return null;
  }
}

export { buildScenePropSvg };
