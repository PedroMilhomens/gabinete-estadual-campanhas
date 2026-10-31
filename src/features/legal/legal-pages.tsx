import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import emblem from '../../assets/brand/emblema-virtudes-atemporais.png'
import { SITE_NAME } from '../../config/site'
import './legal.css'

function LegalLayout({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" to="/login">
          <img
            src={emblem}
            width={44}
            height={44}
            alt="Emblema Virtudes Atemporais"
          />
          <span>{SITE_NAME}</span>
        </Link>
        <nav className="legal-header-nav" aria-label="Navegação institucional">
          <Link to="/privacy">Privacidade</Link>
          <Link to="/terms">Termos de uso</Link>
          <Link className="legal-login-link" to="/login">
            Acessar conta
          </Link>
        </nav>
      </header>
      <article className="legal-card">
        <Link className="legal-home-link" to="/login">
          Voltar ao acesso
        </Link>
        <div className="legal-heading">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-updated">
            Última atualização: 30 de outubro de 2026
          </p>
        </div>
        <div className="legal-content">{children}</div>
        <nav className="legal-nav" aria-label="Documentos legais">
          <Link to="/privacy">Política de privacidade</Link>
          <Link to="/terms">Termos de uso</Link>
        </nav>
      </article>
      <footer className="legal-footer">
        <span>{SITE_NAME}</span>
        <span>Portal de campanhas estaduais · Rondônia</span>
      </footer>
    </main>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Proteção de dados" title="Política de privacidade">
      <section>
        <h2>Dados tratados e finalidade</h2>
        <p>
          O portal trata nome completo, e-mail do capítulo, capítulo, cargo,
          situação do cadastro e datas de aceite para administrar o acesso.
          Descrições, avaliações, comentários e arquivos enviados são tratados
          para organizar e avaliar as atividades das campanhas estaduais.
        </p>
      </section>
      <section>
        <h2>Acesso e armazenamento</h2>
        <p>
          Os dados ficam no Supabase e são acessíveis conforme a função: membros
          veem os envios do próprio capítulo; avaliadores e administradores
          aprovados podem acessar os dados necessários às suas tarefas. Os
          arquivos ficam em armazenamento privado e são exibidos por links
          temporários. O portal não solicita CPF, endereço ou telefone e não usa
          ferramentas de análise ou rastreamento.
        </p>
      </section>
      <section>
        <h2>Serviços de terceiros</h2>
        <p>
          O Supabase processa autenticação, banco de dados e armazenamento. Os
          provedores de e-mail configurados recebem os endereços e o conteúdo
          necessário para enviar confirmações de cadastro e avisos da
          administração. A verificação de segurança Turnstile pode processar
          dados técnicos necessários para identificar tráfego automatizado.
          Esses serviços não são usados para análise de comportamento ou
          publicidade pelo portal.
        </p>
      </section>
      <section>
        <h2>Menores de idade</h2>
        <p>
          O cadastro informa que, quando aplicável, deve haver autorização do
          responsável legal. A participação de adolescentes deve observar seu
          melhor interesse e o processo aplicável da Ordem DeMolay. Evite enviar
          imagens que identifiquem menores, salvo quando houver autorização
          adequada.
        </p>
      </section>
      <section>
        <h2>Seus direitos</h2>
        <p>
          Você pode solicitar confirmação e acesso aos dados, correção,
          informação sobre o tratamento e eliminação quando cabível. Para
          solicitar atendimento ou exercer seus direitos, escreva para{' '}
          <a href="mailto:virtudesatemporais2627@gmail.com">
            virtudesatemporais2627@gmail.com
          </a>
          . Administradores aprovados também podem exportar ou excluir os dados
          de uma conta pela área de gestão de usuários; a exclusão remove a
          conta, seus envios e arquivos associados.
        </p>
      </section>
      <section>
        <h2>Contato</h2>
        <p>
          Dúvidas sobre privacidade e solicitações relacionadas aos dados podem
          ser encaminhadas para{' '}
          <a href="mailto:virtudesatemporais2627@gmail.com">
            virtudesatemporais2627@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout eyebrow="Uso responsável" title="Termos de uso">
      <section>
        <h2>Finalidade e acesso</h2>
        <p>
          O portal apoia o envio, acompanhamento e avaliação das atividades das
          campanhas estaduais {SITE_NAME}. O cadastro exige e-mail do capítulo,
          confirmação de endereço e aprovação administrativa. Mantenha seus
          dados atualizados e não compartilhe sua senha ou acesso.
        </p>
      </section>
      <section>
        <h2>Envios e arquivos</h2>
        <p>
          Envie apenas conteúdo relacionado às atividades e que você tenha
          autorização para compartilhar. Não inclua dados pessoais desnecessários
          nem imagens identificáveis de menores sem autorização adequada.
          Arquivos devem respeitar os formatos e limites indicados no portal.
        </p>
      </section>
      <section>
        <h2>Avaliações e conduta</h2>
        <p>
          Avaliações e comentários são feitos por usuários autorizados e devem
          permanecer relacionados à atividade. A administração pode corrigir o
          acesso de contas e moderar conteúdo que viole estes termos ou coloque
          participantes em risco.
        </p>
      </section>
      <section>
        <h2>Privacidade e encerramento</h2>
        <p>
          O tratamento de dados está descrito na{' '}
          <Link to="/privacy">política de privacidade</Link>. Para solicitar
          correção, exportação ou exclusão dos dados, use o contato informado
          nessa política. O acesso pode ser suspenso quando necessário para
          proteger contas, participantes ou a integridade das campanhas.
        </p>
      </section>
    </LegalLayout>
  )
}
