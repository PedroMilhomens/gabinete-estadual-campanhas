import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { useAuth } from '../auth/use-auth'
import emblem from '../../assets/brand/emblema-virtudes-atemporais.png'
import { SITE_NAME } from '../../config/site'
import {
  calculateChapterRankings,
  csvCell,
  rankingRecordSchema,
  reviewFormSchema,
  reviewListItemSchema,
  reviewSubmissionSchema,
  type ReviewFormValues,
  type ReviewListItem,
  type ReviewSubmission,
  type RankingRecord,
} from './review-schema'
import './review.css'

const reviewListSelection =
  'id, activity_id, chapter_id, submitted_by, description, status, score, created_at, chapter:chapters!submissions_chapter_id_fkey(id, name, number), activity:activities!submissions_activity_id_fkey!inner(id, name, points, campaign_id, campaign:campaigns!activities_campaign_id_fkey(id, name)), submitter:profiles!submissions_submitted_by_fkey(full_name)'

const reviewDetailSelection =
  `${reviewListSelection}, reviewed_at, attachments(id, storage_path, mime, size_bytes), comments(id, body, created_at, author:profiles!comments_author_id_fkey(full_name))`

const rankingSelection =
  'id, chapter_id, status, score, chapter:chapters!submissions_chapter_id_fkey(id, name, number), activity:activities!submissions_activity_id_fkey(campaign_id, campaign:campaigns!activities_campaign_id_fkey(id, name))'

const chapterOptionsSchema = z.array(
  z.object({ id: z.string().uuid(), name: z.string(), number: z.number().int().nullable() }),
)
const campaignOptionsSchema = z.array(
  z.object({ id: z.string().uuid(), name: z.string() }),
)
const activityOptionsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    campaign_id: z.string().uuid().nullable(),
  }),
)

const statusLabels = {
  draft: 'Rascunho',
  submitted: 'Enviada',
  returned: 'Devolvida',
  approved: 'Aprovada',
} as const
const reviewFilterStatusLabels = {
  submitted: statusLabels.submitted,
  returned: statusLabels.returned,
  approved: statusLabels.approved,
} as const

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

function ReviewFrame({
  children,
  memberRanking = false,
}: {
  children: ReactNode
  memberRanking?: boolean
}) {
  const { profile } = useAuth()

  return (
    <main
      className={`review-page${memberRanking ? ' review-page--member-ranking' : ''}${profile?.role === 'reviewer' || profile?.role === 'admin' ? ' review-page--staff' : ''}`}
    >
      <header className="review-header">
        <Link className="review-brand" to="/campaigns">
          <img
            className="review-brand-mark"
            src={emblem}
            width={40}
            height={40}
            alt="Emblema Virtudes Atemporais"
          />
          <span>
            <strong>{SITE_NAME}</strong>
            <small>Campanhas estaduais</small>
          </span>
        </Link>
        <nav className="review-nav" aria-label="Navegação principal">
          <Link to="/campaigns">Campanhas</Link>
          {profile?.role === 'member' && <Link to="/my-submissions">Meus envios</Link>}
          <Link to="/ranking">Ranking</Link>
          {(profile?.role === 'reviewer' || profile?.role === 'admin') && (
            <>
              <Link to="/review">Avaliações</Link>
              <Link to="/export">Exportar CSV</Link>
            </>
          )}
        </nav>
      </header>
      <div className="review-content">{children}</div>
    </main>
  )
}

function ReviewError({ children }: { children: ReactNode }) {
  return <p className="review-alert" role="alert">{children}</p>
}

function ReviewLoading() {
  return <p className="review-muted" role="status">Carregando dados…</p>
}

function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="review-title">
      <p className="review-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

export function ReviewerSubmissionsPage() {
  const { client } = useAuth()
  const location = useLocation()
  const [rows, setRows] = useState<ReviewListItem[]>([])
  const [chapters, setChapters] = useState<z.infer<typeof chapterOptionsSchema>>([])
  const [campaigns, setCampaigns] = useState<z.infer<typeof campaignOptionsSchema>>([])
  const [activities, setActivities] = useState<z.infer<typeof activityOptionsSchema>>([])
  const [chapterId, setChapterId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [activityId, setActivityId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const pageSize = 50
  const notice = z.object({ notice: z.string() }).safeParse(location.state)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [chapterResult, campaignResult, activityResult] = await Promise.all([
          client.from('chapters').select('id, name, number').order('number'),
          client.from('campaigns').select('id, name').order('name'),
          client.from('activities').select('id, name, campaign_id').order('name'),
        ])
        for (const result of [chapterResult, campaignResult, activityResult]) {
          if (result.error) throw result.error
        }

        const parsedChapters = chapterOptionsSchema.parse(chapterResult.data)
        const parsedCampaigns = campaignOptionsSchema.parse(campaignResult.data)
        const parsedActivities = activityOptionsSchema.parse(activityResult.data)
        if (active) {
          setChapters(parsedChapters)
          setCampaigns(parsedCampaigns)
          setActivities(parsedActivities)
        }

        let query = client
          .from('submissions')
          .select(reviewListSelection, { count: 'exact' })
          .in('status', ['submitted', 'returned', 'approved'])
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
        if (chapterId) query = query.eq('chapter_id', chapterId)
        if (campaignId) query = query.eq('activity.campaign_id', campaignId)
        if (activityId) query = query.eq('activity_id', activityId)
        if (status) query = query.eq('status', status)
        const result = await query.range(page * pageSize, (page + 1) * pageSize - 1)
        if (result.error) throw result.error
        const parsedRows = z.array(reviewListItemSchema).parse(result.data)
        if (active) {
          setRows(parsedRows)
          setTotal(result.count ?? parsedRows.length)
        }
      } catch {
        if (active) setError('Não foi possível carregar as avaliações. Tente novamente.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [client, chapterId, campaignId, activityId, status, page])

  const filteredActivities = activities.filter(
    (activity) => !campaignId || activity.campaign_id === campaignId,
  )

  return (
    <ReviewFrame>
      <PageTitle
        eyebrow="Área do avaliador"
        title="Avaliações"
        description="Filtre os envios recebidos e registre a decisão da campanha."
      />
      {notice.success && <p className="review-success" role="status">{notice.data.notice}</p>}
      <section className="review-card" aria-label="Filtros de avaliações">
        <div className="review-filters">
          <label>
            Capítulo
            <select value={chapterId} onChange={(event) => {
              setChapterId(event.target.value)
              setPage(0)
            }}>
              <option value="">Todos os capítulos</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.number ? `${chapter.number} — ` : ''}{chapter.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campanha
            <select
              value={campaignId}
              onChange={(event) => {
                setCampaignId(event.target.value)
                setActivityId('')
                setPage(0)
              }}
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </label>
          <label>
            Atividade
            <select value={activityId} onChange={(event) => {
              setActivityId(event.target.value)
              setPage(0)
            }}>
              <option value="">Todas as atividades</option>
              {filteredActivities.map((activity) => (
                <option key={activity.id} value={activity.id}>{activity.name}</option>
              ))}
            </select>
          </label>
          <label>
            Situação
            <select value={status} onChange={(event) => {
              setStatus(event.target.value)
              setPage(0)
            }}>
              <option value="">Todas as situações</option>
              {Object.entries(reviewFilterStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {error && <ReviewError>{error}</ReviewError>}
      {loading ? (
        <ReviewLoading />
      ) : (
        <>
          <p className="review-muted">
            {total === 0
              ? 'Nenhum envio encontrado.'
              : `Exibindo ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} de ${total} envios.`}
          </p>
          <div className="review-table-wrap">
            <table className="review-table">
              <thead>
                <tr>
                  <th>Capítulo</th>
                  <th>Campanha / atividade</th>
                  <th>Responsável</th>
                  <th>Enviada em</th>
                  <th>Situação</th>
                  <th>Pontuação</th>
                  <th><span className="sr-only">Ação</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.chapter.name}</td>
                    <td>
                      <strong>{row.activity.campaign?.name ?? 'Campanha removida'}</strong>
                      <span className="review-table-secondary">{row.activity.name}</span>
                    </td>
                    <td>{row.submitter?.full_name ?? '—'}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td><span className={`review-status review-status--${row.status}`}>{statusLabels[row.status]}</span></td>
                    <td>{row.score ?? '—'}{row.activity.points !== null ? ` / ${row.activity.points}` : ''}</td>
                    <td><Link className="review-link-button" to={`/review/${row.id}`}>Abrir</Link></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className="review-empty" colSpan={7}>Nenhum envio corresponde aos filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <nav className="review-pagination" aria-label="Paginação das avaliações">
              <button
                className="review-page-button"
                type="button"
                disabled={page === 0 || loading}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Anterior
              </button>
              <span>Página {page + 1} de {Math.ceil(total / pageSize)}</span>
              <button
                className="review-page-button"
                type="button"
                disabled={(page + 1) * pageSize >= total || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </ReviewFrame>
  )
}

type SignedAttachment = ReviewSubmission['attachments'][number] & { signedUrl: string }

export function ReviewSubmissionPage() {
  const { client } = useAuth()
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState<ReviewSubmission | null>(null)
  const [attachments, setAttachments] = useState<SignedAttachment[]>([])
  const [score, setScore] = useState('')
  const [status, setStatus] = useState<ReviewFormValues['status']>('approved')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!submissionId || !z.string().uuid().safeParse(submissionId).success) {
        setError('O identificador do envio é inválido.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const result = await client
          .from('submissions')
          .select(reviewDetailSelection)
          .eq('id', submissionId)
          .maybeSingle()
        if (result.error) throw result.error
        if (!result.data) throw new Error('Submission not found')
        const parsed = reviewSubmissionSchema.parse(result.data)
        if (parsed.status === 'draft') {
          if (active) setError('Envios em rascunho não podem ser acessados pela avaliação.')
          return
        }
        const signed = await Promise.all(
          parsed.attachments.map(async (attachment) => {
            const link = await client.storage
              .from('attachments')
              .createSignedUrl(attachment.storage_path, 300)
            if (link.error) throw link.error
            return { ...attachment, signedUrl: link.data.signedUrl }
          }),
        )
        if (!active) return
        setSubmission(parsed)
        setAttachments(signed)
        setScore(String(parsed.score ?? ''))
      } catch {
        if (active) setError('Não foi possível carregar este envio ou seus anexos.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [client, submissionId])

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!submission) return
    setError(null)
    const parsedScore = Number(score)
    const validation = reviewFormSchema.safeParse({
      score: parsedScore,
      status,
      comment,
    })
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Confira os dados da avaliação.')
      return
    }
    if (submission.activity.points === null || parsedScore > submission.activity.points) {
      setError('A pontuação não pode superar o limite definido para a atividade.')
      return
    }
    setSaving(true)
    try {
      const result = await client.rpc('review_submission', {
        p_submission_id: submission.id,
        p_score: validation.data.score,
        p_status: validation.data.status,
        p_comment: validation.data.comment,
      })
      if (result.error) throw result.error
      navigate('/review', { replace: true, state: { notice: 'Avaliação registrada com sucesso.' } })
    } catch {
      setError('Não foi possível registrar a avaliação. Verifique se o envio ainda pode ser avaliado.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ReviewFrame>
      <Link className="review-back-link" to="/review">← Voltar para avaliações</Link>
      {loading ? <ReviewLoading /> : error && !submission ? <ReviewError>{error}</ReviewError> : submission && (
        <>
          <PageTitle
            eyebrow="Revisão de envio"
            title={submission.activity.name}
            description={`${submission.activity.campaign?.name ?? 'Campanha'} · ${submission.chapter.name} · enviado por ${submission.submitter?.full_name ?? 'membro'}`}
          />
          <div className="review-detail-grid">
            <section className="review-card">
              <h2>Relato da atividade</h2>
              <p className="review-preserved-text">{submission.description || 'Nenhuma descrição informada.'}</p>
              <dl className="review-metadata">
                <div><dt>Capítulo</dt><dd>{submission.chapter.name}</dd></div>
                <div><dt>Data de envio</dt><dd>{formatDate(submission.created_at)}</dd></div>
                <div><dt>Pontuação máxima</dt><dd>{submission.activity.points ?? 'Não definida'}</dd></div>
                <div><dt>Situação</dt><dd>{statusLabels[submission.status]}</dd></div>
              </dl>
              <h2>Anexos</h2>
              {attachments.length === 0 ? (
                <p className="review-muted">Este envio não possui anexos.</p>
              ) : (
                <div className="review-attachments">
                  {attachments.map((attachment) => (
                    <article className="review-attachment" key={attachment.id}>
                      {attachment.mime.startsWith('image/') ? (
                        <a href={attachment.signedUrl} target="_blank" rel="noreferrer">
                          <img src={attachment.signedUrl} alt="Prévia do anexo enviado" />
                        </a>
                      ) : (
                        <span className="review-pdf-icon" aria-hidden="true">PDF</span>
                      )}
                      <div>
                        <p>{attachment.mime === 'application/pdf' ? 'Documento PDF' : 'Imagem'}</p>
                        <a href={attachment.signedUrl} target="_blank" rel="noreferrer">
                          Abrir anexo
                        </a>
                        <small>Link privado temporário (5 minutos).</small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <aside className="review-card">
              <h2>Comentários</h2>
              <div className="review-comments">
                {submission.comments.length === 0 ? (
                  <p className="review-muted">Nenhum comentário registrado.</p>
                ) : submission.comments.map((item) => (
                  <article className="review-comment" key={item.id}>
                    <p className="review-comment-meta">
                      {item.author?.full_name ?? 'Equipe de avaliação'} · {formatDate(item.created_at)}
                    </p>
                    <p className="review-preserved-text">{item.body ?? ''}</p>
                  </article>
                ))}
              </div>
              {['submitted', 'returned'].includes(submission.status) ? (
                <form className="review-form" onSubmit={(event) => void submitReview(event)}>
                  <h2>Registrar decisão</h2>
                  <label>
                    Pontuação (0 a {submission.activity.points ?? 0})
                    <input
                      type="number"
                      min="0"
                      max={submission.activity.points ?? 0}
                      step="1"
                      required
                      value={score}
                      onChange={(event) => setScore(event.target.value)}
                    />
                  </label>
                  <label>
                    Decisão
                    <select
                      value={status}
                      onChange={(event) => {
                        if (event.target.value === 'approved' || event.target.value === 'returned') {
                          setStatus(event.target.value)
                        }
                      }}
                    >
                      <option value="approved">Aprovar</option>
                      <option value="returned">Devolver para ajustes</option>
                    </select>
                  </label>
                  <label>
                    Comentário obrigatório
                    <textarea
                      maxLength={2000}
                      required
                      rows={5}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                    />
                  </label>
                  {error && <ReviewError>{error}</ReviewError>}
                  <button className="review-submit" type="submit" disabled={saving}>
                    {saving ? 'Salvando…' : 'Salvar avaliação'}
                  </button>
                </form>
              ) : (
                <p className="review-muted">Este envio não está disponível para nova avaliação.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </ReviewFrame>
  )
}

export function RankingPage() {
  const { client, profile } = useAuth()
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [records, setRecords] = useState<RankingRecord[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const campaignResult = await client.from('campaigns').select('id, name').order('name')
        if (campaignResult.error) throw campaignResult.error
        const parsedRecords: RankingRecord[] = []
        for (let offset = 0; ; offset += 500) {
          const result = await client
            .from('submissions')
            .select(rankingSelection)
            .eq('status', 'approved')
            .order('id')
            .range(offset, offset + 499)
          if (result.error) throw result.error
          const page = z.array(rankingRecordSchema).parse(result.data)
          parsedRecords.push(...page)
          if (page.length < 500) break
        }
        const parsedCampaigns = campaignOptionsSchema.parse(campaignResult.data)
        if (!active) return
        setRecords(parsedRecords)
        setCampaigns(parsedCampaigns)
      } catch {
        if (active) setError('Não foi possível carregar o ranking.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [client])

  const visibleRankings = calculateChapterRankings(
    records.filter((record) => !campaignId || record.activity.campaign_id === campaignId),
  )

  return (
    <ReviewFrame memberRanking={profile?.role === 'member'}>
      <PageTitle
        eyebrow="Resultados"
        title="Ranking por capítulo"
        description={`Pontuação total de envios aprovados${profile?.role === 'member' ? ' no seu capítulo' : ''}.`}
      />
      <section className="review-card">
        <label className="review-campaign-filter">
          Campanha
          <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
            <option value="">Todas as campanhas</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        </label>
        {error && <ReviewError>{error}</ReviewError>}
        {loading ? <ReviewLoading /> : (
          <ol className="ranking-list">
            {visibleRankings.map((item, index) => (
              <li key={item.chapterId}>
                <span className="ranking-position">{index + 1}</span>
                <span className="ranking-name">
                  <strong>{item.chapterNumber ? `${item.chapterNumber}º ` : ''}{item.chapterName}</strong>
                  <small>{item.approvedSubmissions} envio(s) aprovado(s)</small>
                </span>
                <strong className="ranking-score">{item.totalScore} pts</strong>
              </li>
            ))}
            {visibleRankings.length === 0 && <li className="review-muted">Ainda não há pontuações aprovadas.</li>}
          </ol>
        )}
      </section>
    </ReviewFrame>
  )
}

export function SubmissionExportPage() {
  const { client } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function exportCsv() {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const rows: ReviewListItem[] = []
      for (let offset = 0; ; offset += 500) {
        const result = await client
          .from('submissions')
          .select(reviewListSelection)
          .in('status', ['submitted', 'returned', 'approved'])
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + 499)
        if (result.error) throw result.error
        const page = z.array(reviewListItemSchema).parse(result.data)
        rows.push(...page)
        if (page.length < 500) break
      }
      const header = [
        'Capítulo',
        'Número do capítulo',
        'Campanha',
        'Atividade',
        'Responsável',
        'Situação',
        'Pontuação',
        'Pontuação máxima',
        'Enviada em',
        'Descrição',
      ]
      const lines = rows.map((row) => [
        row.chapter.name,
        row.chapter.number,
        row.activity.campaign?.name ?? '',
        row.activity.name,
        row.submitter?.full_name ?? '',
        statusLabels[row.status],
        row.score,
        row.activity.points,
        row.created_at,
        row.description,
      ].map(csvCell).join(','))
      const csv = `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\r\n')}`
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `envios-demolay-ro-${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice(`CSV exportado com ${rows.length} envio(s).`)
    } catch {
      setError('Não foi possível exportar os envios. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReviewFrame>
      <PageTitle
        eyebrow="Relatórios"
        title="Exportar envios"
        description="Baixe uma planilha CSV com os dados de campanhas e avaliações visíveis para sua função."
      />
      <section className="review-card review-export-card">
        <p>O arquivo inclui capítulo, campanha, atividade, responsável, situação, pontuação e descrição. Textos com fórmulas são neutralizados para reduzir riscos ao abrir em planilhas.</p>
        <button className="review-submit" type="button" onClick={() => void exportCsv()} disabled={loading}>
          {loading ? 'Preparando arquivo…' : 'Baixar CSV'}
        </button>
        {error && <ReviewError>{error}</ReviewError>}
        {notice && <p className="review-success" role="status">{notice}</p>}
      </section>
    </ReviewFrame>
  )
}
