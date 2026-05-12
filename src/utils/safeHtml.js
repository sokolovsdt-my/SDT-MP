import DOMPurify from 'dompurify'

// Безопасная обёртка для dangerouslySetInnerHTML.
// Новости и шаблоны рассылок редактируются админами через RichEditor
// (execCommand + paste), что пропускает произвольный HTML. Stored XSS в
// этой ленте видят все клиенты, поэтому весь HTML прогоняется через
// DOMPurify перед рендером.
export const safeHtml = (html) => ({
  __html: DOMPurify.sanitize(html || '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS:  ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR:  ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  }),
})
