import { useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

type CaptchaFieldProps = {
  onToken: (token: string | null) => void
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

export function CaptchaField({ onToken }: CaptchaFieldProps) {
  const [widgetError, setWidgetError] = useState(false)

  if (!siteKey) {
    return (
      <p className="form-note form-note--error" role="alert">
        O CAPTCHA ainda não foi configurado. Configure VITE_TURNSTILE_SITE_KEY
        para habilitar a autenticação.
      </p>
    )
  }

  return (
    <div className="captcha-field" aria-label="Verificação de segurança">
      <Turnstile
        siteKey={siteKey}
        options={{ language: 'pt-BR' }}
        onSuccess={(token) => {
          setWidgetError(false)
          onToken(token)
        }}
        onExpire={() => onToken(null)}
        onError={() => {
          setWidgetError(true)
          onToken(null)
        }}
      />
      {widgetError && (
        <p className="form-note form-note--error" role="alert">
          Não foi possível validar o CAPTCHA. Atualize a verificação e tente
          novamente.
        </p>
      )}
    </div>
  )
}
