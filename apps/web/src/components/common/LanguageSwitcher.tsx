import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LANGUAGES,
  setLanguage,
  type SupportedLanguage,
} from "../../i18n";

const LABELS: Record<SupportedLanguage, string> = {
  ja: "日本語",
  en: "English",
};

// Spec §17: tag each option with its own `lang` so screen readers switch
// pronunciation rules when reading "日本語" vs "English".
const OPTION_LANG: Record<SupportedLanguage, string> = {
  ja: "ja",
  en: "en",
};

type Props = {
  className?: string;
};

export default function LanguageSwitcher({ className }: Props) {
  const { i18n, t } = useTranslation();
  const current = (
    SUPPORTED_LANGUAGES as readonly string[]
  ).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : "ja";

  return (
    <label
      className={
        className ?? "flex items-center gap-1 text-xs text-gray-300"
      }
      data-testid="language-switcher"
    >
      <span className="sr-only">{t("settings.language")}</span>
      <select
        aria-label={t("settings.language")}
        className="bg-gray-800 text-white border border-gray-700 rounded px-1 py-0.5"
        value={current}
        onChange={(e) => {
          void setLanguage(e.target.value as SupportedLanguage);
        }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang} value={lang} lang={OPTION_LANG[lang]}>
            {LABELS[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}
