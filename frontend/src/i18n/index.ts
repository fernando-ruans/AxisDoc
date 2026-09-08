import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ptBR } from './ptBR'
import { en } from './en'
import { es } from './es'

const STORAGE_KEY = 'axisdoc.lang'

export function initI18n(): void {
  const saved = localStorage.getItem(STORAGE_KEY)
  void i18n.use(initReactI18next).init({
    resources: {
      'pt-BR': { translation: ptBR },
      en: { translation: en },
      es: { translation: es },
    },
    lng: saved ?? 'pt-BR',
    fallbackLng: 'pt-BR',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

export function setLanguage(lng: string): void {
  void i18n.changeLanguage(lng)
  localStorage.setItem(STORAGE_KEY, lng)
}

export default i18n
