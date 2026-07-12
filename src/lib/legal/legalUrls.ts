import { i18n } from '../../i18n';

const LEGAL_BASE = 'https://nextcloud.software-by-design.de';

/** Locale-aware privacy and terms URLs — must match docs/play-store/PUBLISH-LEGAL.md */
export function privacyPolicyUrl(): string {
  return i18n.locale === 'de'
    ? `${LEGAL_BASE}/de/datenschutz-seacheck-mobile.html`
    : `${LEGAL_BASE}/en/privacy-seacheck-mobile.html`;
}

export function termsOfUseUrl(): string {
  return i18n.locale === 'de'
    ? `${LEGAL_BASE}/de/nutzungsbedingungen-seacheck-mobile.html`
    : `${LEGAL_BASE}/en/terms-seacheck-mobile.html`;
}
