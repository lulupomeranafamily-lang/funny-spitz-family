/**
 * Bíblia Visual e de Vozes - Funny Spitz Family (@FunnySpitzFamily)
 */
export const CHARACTERS = {
  NARRADOR: {
    name: "Narrador",
    visual: "Exterior of the cozy two-story blue family house at dusk with warm glowing windows, white picket fence, and garden roses.",
    voices: {
      pt: "pt-BR-AntonioNeural",
      en: "en-US-GuyNeural"
    },
    voiceProfile: { pitch: 0.96, tempo: 1.06, bassGainDb: 2 }
  },
  RAVEN: {
    name: "Raven (Mamãe)",
    visual: "Black Pomeranian (German Spitz) dog wearing round gold-rimmed glasses, a white pearl necklace, and a colorful floral print blouse/dress.",
    voices: {
      pt: "pt-BR-FranciscaNeural",
      en: "en-US-JennyNeural"
    },
    voiceProfile: { pitch: 1.0, tempo: 1.06, bassGainDb: 0 }
  },
  VLAD: {
    name: "Vlad (Papai - Alfa da Família)",
    visual: "Cream/light golden-white Pomeranian (German Spitz) dog wearing thin round gold-rimmed glasses, a blue-and-white vertical striped button-down shirt, and a dark navy blue bow tie with tiny dots.",
    voices: {
      pt: "en-US-BrianMultilingualNeural",
      en: "en-US-BrianMultilingualNeural"
    },
    // Tom paterno grave, calmo, macio e aveludado (BrianMultilingualNeural)
    voiceProfile: { pitch: 0.90, tempo: 1.00, bassGainDb: 3, smoothTreble: true }
  },
  LUNA: {
    name: "Luna (15 anos)",
    visual: "Black Pomeranian (German Spitz) dog wearing round gold-rimmed glasses, a white pearl necklace, and a pink ruffled blouse.",
    voices: {
      pt: "pt-BR-FranciscaNeural",
      en: "en-US-AriaNeural"
    },
    voiceProfile: { pitch: 1.12, tempo: 1.08, bassGainDb: 0 }
  },
  THEO: {
    name: "Theo (10 anos)",
    visual: "Cream/light orange Pomeranian (German Spitz) dog wearing rainbow multicolored frame glasses and a blue button-down shirt.",
    voices: {
      pt: "pt-BR-AntonioNeural",
      en: "en-US-AnaNeural"
    },
    voiceProfile: { pitch: 1.28, tempo: 1.08, bassGainDb: 0 }
  },
  JONNY: {
    name: "Jonny (8 anos)",
    visual: "Cream/light golden Pomeranian (German Spitz) dog with NO glasses, wearing a white button-down shirt and a dark bow tie.",
    voices: {
      pt: "pt-BR-FranciscaNeural",
      en: "en-US-AnaNeural"
    },
    voiceProfile: { pitch: 1.24, tempo: 1.10, bassGainDb: 0 }
  },
  FAMILIA: {
    name: "Família Spitz",
    visual: "All 5 Pomeranian family members together: Raven, Vlad, Luna, Theo, and Jonny.",
    voices: {
      pt: "pt-BR-FranciscaNeural",
      en: "en-US-JennyNeural"
    },
    voiceProfile: { pitch: 1.08, tempo: 1.08, bassGainDb: 0 }
  }
};
