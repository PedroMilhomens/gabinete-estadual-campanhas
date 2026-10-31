import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/use-auth'
import emblem from '../../assets/brand/emblema-virtudes-atemporais.png'
import { SITE_NAME } from '../../config/site'
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS,
  attachmentFileSchema,
  submissionFormSchema,
  submissionListItemSchema,
  submissionSchema,
  type Submission,
  type SubmissionListItem,
} from './submission-schema'
import './submissions.css'

const submissionDetailSelection =
  'id, activity_id, chapter_id, submitted_by, description, status, score, reviewed_at, created_at, activity:activities(id, name, points, due_at, campaign:campaigns(name)), attachments(id, storage_path, mime, size_bytes), comments(id, body, created_at, author:profiles(full_name))'

const submissionListSelection =
  'id, activity_id, chapter_id, submitted_by, description, status, score, created_at, activity:activities(name, campaign:campaigns(name))'

const activityRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  points: z.number().int().nullable(),
  due_at: z.string().nullable(),
  campaign: z.object({ name: z.string() }).nullable(),
})

type ActivityRecord = z.infer<typeof activityRecordSchema>

type SignedAttachment = Submission['attachments'][number] & {
  signedUrl: string
}

const statusLabels: Record<SubmissionListItem['status'], string> = {
  draft: 'Rascunho',
  submitted: 'Enviada',
  returned: 'Devolvida',
  approved: 'Aprovada',
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function PageHeader() {
  return (
    <header className="submission-header">
      <Link className="campaign-brand" to="/campaigns">
        <img
          className="campaign-brand-mark"
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
      <nav className="submission-nav" aria-label="Navegação principal">
        <Link to="/campaigns">Campanhas</Link>
        <Link to="/my-submissions">Meus envios</Link>
      </nav>
    </header>
  )
}

function SubmissionStatus({ status }: { status: SubmissionListItem['status'] }) {
  return (
    <span className={`submission-status submission-status--${status}`}>
      {statusLabels[status]}
    </span>
  )
}

function AttachmentDropzone({
  files,
  onFiles,
  existingCount,
}: {
  files: File[]
  onFiles: (files: File[], error: string | null) => void
  existingCount: number
}) {
  const remainingSlots = Math.max(0, MAX_ATTACHMENTS - existingCount - files.length)
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      const error = fileRejections.length
        ? fileRejections.some((rejection) =>
            rejection.errors.some((item) => item.code === 'file-too-large'),
          )
          ? 'Cada arquivo deve ter no máximo 5 MB.'
          : fileRejections.some((rejection) =>
                rejection.errors.some((item) => item.code === 'file-invalid-type'),
              )
            ? 'Use apenas imagens JPEG, PNG ou arquivos PDF.'
            : 'É possível anexar no máximo cinco arquivos por envio.'
        : null
      onFiles([...files, ...acceptedFiles], error)
    },
    [files, onFiles],
  )
  const { getRootProps, getInputProps, isDragActive, isDragReject, open } =
    useDropzone({
      onDrop,
      accept: {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'application/pdf': ['.pdf'],
      },
      maxSize: MAX_ATTACHMENT_SIZE,
      maxFiles: remainingSlots,
      multiple: true,
      noClick: true,
      disabled: remainingSlots === 0,
    })

  return (
    <div
      {...getRootProps({
        className: `attachment-dropzone${isDragActive ? ' is-active' : ''}${isDragReject ? ' is-rejected' : ''}${remainingSlots === 0 ? ' is-full' : ''}`,
      })}
    >
      <input {...getInputProps()} />
      <span className="attachment-dropzone-icon" aria-hidden="true">
        ↑
      </span>
      <div>
        <strong>
          {remainingSlots
            ? isDragActive
              ? 'Solte os arquivos aqui'
              : 'Arraste arquivos ou escolha no dispositivo'
            : 'Limite de anexos atingido'}
        </strong>
        <p>JPEG, PNG ou PDF · até 5 MB cada · máximo de 5 arquivos</p>
      </div>
      {remainingSlots > 0 && (
        <button
          type="button"
          className="submission-button submission-button--secondary"
          onClick={open}
        >
          Escolher arquivos
        </button>
      )}
    </div>
  )
}

function SubmissionEditor({
  activity,
  existingSubmission,
  onCreated,
}: {
  activity: ActivityRecord
  existingSubmission: Submission | null
  onCreated: (submissionId: string) => void
}) {
  const { client, profile, session } = useAuth()
  const [description, setDescription] = useState(
    existingSubmission?.description ?? '',
  )
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const keptAttachments =
    existingSubmission?.attachments.filter(
      (attachment) => !removedAttachmentIds.includes(attachment.id),
    ) ?? []
  const isEditable =
    !existingSubmission ||
    (existingSubmission.submitted_by === session?.user.id &&
      ['draft', 'returned'].includes(existingSubmission.status))

  const removeNewFile = (fileToRemove: File) => {
    setNewFiles((current) =>
      current.filter((file) => file !== fileToRemove),
    )
    setFileError(null)
  }

  const uploadFiles = async (submissionId: string) => {
    if (!profile?.chapter_id) {
      throw new Error('O perfil não está vinculado a um capítulo.')
    }

    const uploadedPaths: string[] = []
    const metadata: {
      submission_id: string
      storage_path: string
      mime: string
      size_bytes: number
    }[] = []

    for (const file of newFiles) {
      const parsedFile = attachmentFileSchema.safeParse({
        type: file.type,
        size: file.size,
      })
      if (!parsedFile.success) {
        throw new Error('O tipo ou tamanho de um dos anexos não é permitido.')
      }

      const extensionByMime: Record<(typeof ALLOWED_ATTACHMENT_TYPES)[number], string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'application/pdf': 'pdf',
      }
      const mime = ALLOWED_ATTACHMENT_TYPES.find((type) => type === file.type)
      const extension = mime ? extensionByMime[mime] : undefined
      if (!extension) {
        throw new Error('Use apenas arquivos JPEG, PNG ou PDF.')
      }

      const storagePath = `${profile.chapter_id}/${submissionId}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await client.storage
        .from('attachments')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        const cleanup =
          uploadedPaths.length > 0
            ? await client.storage.from('attachments').remove(uploadedPaths)
            : { error: null }
        const cleanupMessage = cleanup.error
          ? ' Alguns arquivos temporários podem precisar de remoção pelo suporte.'
          : ''
        throw new Error(
          `Não foi possível enviar os anexos.${cleanupMessage}`,
        )
      }

      uploadedPaths.push(storagePath)
      metadata.push({
        submission_id: submissionId,
        storage_path: storagePath,
        mime: file.type,
        size_bytes: file.size,
      })
    }

    if (metadata.length === 0) return

    const { error: metadataError } = await client
      .from('attachments')
      .insert(metadata)

    if (metadataError) {
      const cleanup = await client.storage
        .from('attachments')
        .remove(uploadedPaths)
      const cleanupMessage = cleanup.error
        ? ' Alguns arquivos temporários podem precisar de remoção pelo suporte.'
        : ''
      throw new Error(
        `Não foi possível registrar os anexos enviados.${cleanupMessage}`,
      )
    }
  }

  const removeDeletedAttachments = async () => {
    if (!existingSubmission || removedAttachmentIds.length === 0) return

    const deletedAttachments = existingSubmission.attachments.filter(
      (attachment) => removedAttachmentIds.includes(attachment.id),
    )
    const paths = deletedAttachments.map((attachment) => attachment.storage_path)
    const { error: storageError } = await client.storage
      .from('attachments')
      .remove(paths)
    if (storageError) {
      throw new Error('Não foi possível remover um ou mais anexos.')
    }

    const { data: deletedRows, error: metadataError } = await client
      .from('attachments')
      .delete()
      .in('id', removedAttachmentIds)
      .select('id')
    if (metadataError || deletedRows.length !== removedAttachmentIds.length) {
      throw new Error(
        'Os arquivos foram removidos, mas não foi possível atualizar a lista de anexos. Tente recarregar a página.',
      )
    }
  }

  const save = async (submit: boolean) => {
    setFormError(null)
    setFileError(null)

    const parsedForm = submissionFormSchema.safeParse({ description })
    if (!parsedForm.success) {
      setFormError(
        parsedForm.error.issues[0]?.message ?? 'Revise a descrição informada.',
      )
      return
    }
    if (submit && !parsedForm.data.description) {
      setFormError('Escreva uma descrição antes de enviar para avaliação.')
      return
    }
    if (keptAttachments.length + newFiles.length > MAX_ATTACHMENTS) {
      setFormError('Um envio pode conter no máximo cinco anexos.')
      return
    }
    if (!profile?.chapter_id || !session) {
      setFormError('Não foi possível verificar seu capítulo. Entre novamente.')
      return
    }

    setSaving(true)
    try {
      let submissionId = existingSubmission?.id

      if (!submissionId) {
        const { data, error } = await client
          .from('submissions')
          .insert({
            activity_id: activity.id,
            chapter_id: profile.chapter_id,
            submitted_by: session.user.id,
            description: parsedForm.data.description || null,
            status: 'draft',
          })
          .select('id')
          .single()

        if (error || !data) {
          setFormError(
            'Não foi possível iniciar o envio. Talvez seu capítulo já tenha um cadastro para esta atividade.',
          )
          return
        }
        submissionId = data.id
      }

      await uploadFiles(submissionId)
      await removeDeletedAttachments()

      const { data: updatedSubmission, error: updateError } = await client
        .from('submissions')
        .update({
          description: parsedForm.data.description || null,
          status: submit ? 'submitted' : 'draft',
        })
        .eq('id', submissionId)
        .select('id')
        .maybeSingle()

      if (updateError || !updatedSubmission) {
        setFormError(
          'Os dados foram salvos como rascunho, mas não foi possível atualizar o envio. Recarregue e tente novamente.',
        )
        return
      }

      onCreated(submissionId)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o envio. Tente novamente.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (!isEditable) {
    return (
      <div className="submission-alert" role="status">
        Esta atividade já possui um envio do seu capítulo. Somente quem criou o
        envio pode editar ou reenviar.
      </div>
    )
  }

  return (
    <form
      className="submission-editor"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void save(true)
      }}
    >
      <label className="submission-field">
        <span>Descrição da atividade realizada</span>
        <textarea
          rows={7}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Conte como a atividade foi realizada pelo capítulo…"
          aria-describedby="submission-description-count"
        />
        <span
          className="submission-character-count"
          id="submission-description-count"
        >
          {description.length}/5000 caracteres
        </span>
      </label>

      {keptAttachments.length > 0 && (
        <section className="submission-existing-files">
          <h3>Anexos adicionados</h3>
          {keptAttachments.map((attachment) => (
            <div className="submission-file" key={attachment.id}>
              <span className="submission-file-icon" aria-hidden="true">
                {attachment.mime === 'application/pdf' ? 'PDF' : 'IMG'}
              </span>
              <span className="submission-file-name">
                {attachment.storage_path.split('/').at(-1)}
              </span>
              <span className="submission-file-size">
                {(attachment.size_bytes / (1024 * 1024)).toFixed(1)} MB
              </span>
              <button
                type="button"
                className="submission-remove-file"
                onClick={() =>
                  setRemovedAttachmentIds((current) => [
                    ...current,
                    attachment.id,
                  ])
                }
                disabled={saving}
                aria-label="Remover anexo"
              >
                Remover
              </button>
            </div>
          ))}
        </section>
      )}

      {newFiles.length > 0 && (
        <section className="submission-existing-files">
          <h3>Novos anexos</h3>
          {newFiles.map((file, index) => (
            <div className="submission-file" key={`${file.name}-${file.size}-${index}`}>
              <span className="submission-file-icon" aria-hidden="true">
                {file.type === 'application/pdf' ? 'PDF' : 'IMG'}
              </span>
              <span className="submission-file-name">{file.name}</span>
              <span className="submission-file-size">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </span>
              <button
                type="button"
                className="submission-remove-file"
                onClick={() => removeNewFile(file)}
                disabled={saving}
                aria-label={`Remover ${file.name}`}
              >
                Remover
              </button>
            </div>
          ))}
        </section>
      )}

      <AttachmentDropzone
        files={newFiles}
        existingCount={keptAttachments.length}
        onFiles={(files, error) => {
          setNewFiles(files)
          setFileError(error)
        }}
      />
      {fileError && (
        <p className="submission-form-error" role="alert">
          {fileError}
        </p>
      )}
      <p className="submission-guidance">
        Evite anexar imagens que identifiquem menores de idade, salvo quando
        houver autorização adequada do responsável.
      </p>
      {formError && (
        <p className="submission-form-error" role="alert">
          {formError}
        </p>
      )}
      <div className="submission-form-actions">
        <Link
          className="submission-button submission-button--secondary"
          to="/campaigns"
        >
          Cancelar
        </Link>
        <button
          className="submission-button submission-button--secondary"
          type="button"
          disabled={saving}
          onClick={() => void save(false)}
        >
          {saving ? 'Salvando…' : 'Salvar rascunho'}
        </button>
        <button
          className="submission-button submission-button--primary"
          type="submit"
          disabled={saving}
        >
          {saving
            ? 'Enviando…'
            : existingSubmission?.status === 'returned'
              ? 'Reenviar para avaliação'
              : 'Enviar para avaliação'}
        </button>
      </div>
    </form>
  )
}

function SubmissionFormPage() {
  const { client, profile, session, loading: authLoading, error: authError } =
    useAuth()
  const chapterId = profile?.chapter_id
  const sessionUserId = session?.user.id
  const { activityId } = useParams()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<ActivityRecord | null>(null)
  const [existingSubmission, setExistingSubmission] =
    useState<Submission | null>(null)
  const [chapterSubmissionExists, setChapterSubmissionExists] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!activityId || !chapterId || !sessionUserId) {
      setLoadError('Não foi possível determinar a atividade ou o capítulo.')
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    setExistingSubmission(null)
    setChapterSubmissionExists(false)

    try {
      const [{ data: activityData, error: activityError }, submissionResult] =
        await Promise.all([
          client
            .from('activities')
            .select(
              'id, name, description, points, due_at, campaign:campaigns(name)',
            )
            .eq('id', activityId)
            .maybeSingle(),
          client
            .from('submissions')
            .select(submissionDetailSelection)
            .eq('activity_id', activityId)
            .eq('chapter_id', chapterId)
            .maybeSingle(),
        ])

      if (activityError || !activityData) {
        setLoadError('Não foi possível carregar esta atividade.')
        return
      }
      const parsedActivity = activityRecordSchema.safeParse(activityData)
      if (!parsedActivity.success) {
        setLoadError('Os dados desta atividade não puderam ser validados.')
        return
      }
      setActivity(parsedActivity.data)

      if (submissionResult.error) {
        setLoadError('Não foi possível carregar o envio desta atividade.')
        return
      }

      if (submissionResult.data) {
        if (submissionResult.data.submitted_by !== sessionUserId) {
          setChapterSubmissionExists(true)
          setExistingSubmission(null)
        } else {
          const parsedSubmission = submissionSchema.safeParse(
            submissionResult.data,
          )
          if (!parsedSubmission.success) {
            setLoadError('Os dados do envio não puderam ser validados.')
            return
          } else {
            setChapterSubmissionExists(false)
          }
          setExistingSubmission(parsedSubmission.data)
        }
      }
    } catch {
      setLoadError('Não foi possível carregar a atividade. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [activityId, chapterId, client, sessionUserId])

  useEffect(() => {
    if (!authLoading && profile?.status === 'approved' && profile.role === 'member') {
      const request = window.setTimeout(() => {
        void loadData()
      }, 0)
      return () => window.clearTimeout(request)
    }
    return undefined
  }, [authLoading, loadData, profile?.role, profile?.status])

  if (authLoading) {
    return (
      <main className="submission-page">
        <p role="status">Verificando sua conta…</p>
      </main>
    )
  }
  if (authError) {
    return (
      <main className="submission-page">
        <p className="submission-alert" role="alert">{authError}</p>
      </main>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (profile?.status !== 'approved') {
    return <Navigate to="/awaiting-approval" replace />
  }
  if (profile.role !== 'member') return <Navigate to="/" replace />

  return (
    <main className="submission-page">
      <section className="submission-content">
        <PageHeader />
        <nav className="submission-breadcrumb" aria-label="Navegação estrutural">
          <Link to="/campaigns">Campanhas</Link>
          <span aria-hidden="true">/</span>
          <Link to="/my-submissions">Meus envios</Link>
          <span aria-hidden="true">/</span>
          <span>Novo envio</span>
        </nav>
        {loading ? (
          <p className="submission-panel" role="status">
            Carregando atividade…
          </p>
        ) : loadError ? (
          <div className="submission-panel" role="alert">
            <p>{loadError}</p>
            <button
              className="submission-button submission-button--secondary"
              type="button"
              onClick={() => void loadData()}
            >
              Tentar novamente
            </button>
          </div>
        ) : activity ? (
          <>
            <header className="submission-title">
              <p className="submission-eyebrow">
                {activity.campaign?.name ?? 'Campanha estadual'}
              </p>
              <h1>{activity.name}</h1>
              <p>{activity.description}</p>
              <div className="submission-activity-meta">
                <span>{activity.points ?? 0} pontos</span>
                {activity.due_at && (
                  <span>Prazo: {formatDateTime(activity.due_at)}</span>
                )}
              </div>
            </header>
            <section className="submission-panel">
              <div className="submission-section-title">
                <div>
                  <p className="submission-eyebrow">Envio do capítulo</p>
                  <h2>
                    {existingSubmission?.status === 'returned'
                      ? 'Revise e reenvie'
                      : existingSubmission
                        ? 'Atualize seu envio'
                        : 'Registrar atividade'}
                  </h2>
                </div>
                {existingSubmission && (
                  <SubmissionStatus status={existingSubmission.status} />
                )}
              </div>
              {chapterSubmissionExists ? (
                <div className="submission-alert" role="status">
                  Seu capítulo já possui um envio para esta atividade feito por
                  outro membro. Fale com quem criou o envio para solicitar
                  alterações.
                </div>
              ) : (
                <SubmissionEditor
                  key={existingSubmission?.id ?? activity.id}
                  activity={activity}
                  existingSubmission={existingSubmission}
                  onCreated={(submissionId) =>
                    navigate(`/my-submissions/${submissionId}`, {
                      replace: true,
                    })
                  }
                />
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}

function MySubmissionsPage() {
  const { client, profile, session, loading: authLoading, error: authError } =
    useAuth()
  const chapterId = profile?.chapter_id
  const sessionUserId = session?.user.id
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadSubmissions = useCallback(async () => {
    if (!sessionUserId || !chapterId) {
      setLoadError('Não foi possível determinar seu capítulo.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)

    try {
      const { data, error } = await client
        .from('submissions')
        .select(submissionListSelection)
        .eq('submitted_by', sessionUserId)
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError('Não foi possível carregar seus envios. Tente novamente.')
        return
      }
      const parsed = z.array(submissionListItemSchema).safeParse(data)
      if (!parsed.success) {
        setLoadError('A lista de envios retornou dados inválidos.')
        return
      }
      setSubmissions(parsed.data)
    } catch {
      setLoadError('Não foi possível carregar seus envios. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [chapterId, client, sessionUserId])

  useEffect(() => {
    if (!authLoading && profile?.status === 'approved' && profile.role === 'member') {
      const request = window.setTimeout(() => {
        void loadSubmissions()
      }, 0)
      return () => window.clearTimeout(request)
    }
    return undefined
  }, [authLoading, loadSubmissions, profile?.role, profile?.status])

  if (authLoading) {
    return (
      <main className="submission-page">
        <p role="status">Verificando sua conta…</p>
      </main>
    )
  }
  if (authError) {
    return (
      <main className="submission-page">
        <p className="submission-alert" role="alert">{authError}</p>
      </main>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (profile?.status !== 'approved') {
    return <Navigate to="/awaiting-approval" replace />
  }
  if (profile.role !== 'member') return <Navigate to="/" replace />

  return (
    <main className="submission-page">
      <section className="submission-content">
        <PageHeader />
        <header className="my-submissions-heading">
          <div>
            <p className="submission-eyebrow">Acompanhamento</p>
            <h1>Meus envios</h1>
            <p>Acompanhe os rascunhos, avaliações e devoluções do seu capítulo.</p>
          </div>
          <Link
            className="submission-button submission-button--primary"
            to="/campaigns"
          >
            Ver campanhas
          </Link>
        </header>
        {loadError ? (
          <div className="submission-panel" role="alert">
            <p>{loadError}</p>
            <button
              className="submission-button submission-button--secondary"
              type="button"
              onClick={() => void loadSubmissions()}
            >
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <p className="submission-panel" role="status">
            Carregando envios…
          </p>
        ) : submissions.length === 0 ? (
          <div className="submission-empty">
            <span className="submission-empty-icon" aria-hidden="true">
              ↑
            </span>
            <h2>Nenhum envio ainda</h2>
            <p>Quando seu capítulo enviar uma atividade, ela aparecerá aqui.</p>
            <Link
              className="submission-button submission-button--primary"
              to="/campaigns"
            >
              Explorar campanhas
            </Link>
          </div>
        ) : (
          <div className="my-submission-list">
            {submissions.map((submission) => (
              <Link
                className="my-submission-card"
                key={submission.id}
                to={`/my-submissions/${submission.id}`}
              >
                <div className="my-submission-info">
                  <span className="submission-eyebrow">
                    {submission.activity.campaign?.name ??
                      'Campanha estadual'}
                  </span>
                  <h2>{submission.activity.name}</h2>
                  <p>
                    Atualizado em {formatDate(submission.created_at) ?? '—'}
                  </p>
                </div>
                <div className="my-submission-meta">
                  {submission.score !== null && (
                    <span className="submission-score">
                      {submission.score} pontos
                    </span>
                  )}
                  <SubmissionStatus status={submission.status} />
                  <span aria-hidden="true" className="submission-arrow">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function SubmissionDetailPage() {
  const { client, profile, session, loading: authLoading, error: authError } =
    useAuth()
  const chapterId = profile?.chapter_id
  const sessionUserId = session?.user.id
  const { submissionId } = useParams()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [attachments, setAttachments] = useState<SignedAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const loadSubmission = useCallback(async () => {
    if (!submissionId || !sessionUserId || !chapterId) {
      setLoadError('Não foi possível determinar o envio solicitado.')
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    setAttachmentError(null)
    setAttachments([])
    let hasLoadedSubmission = false
    try {
      const { data, error } = await client
        .from('submissions')
        .select(submissionDetailSelection)
        .eq('id', submissionId)
        .eq('chapter_id', chapterId)
        .eq('submitted_by', sessionUserId)
        .maybeSingle()

      if (error || !data) {
        setLoadError('Não foi possível localizar este envio.')
        return
      }
      const parsed = submissionSchema.safeParse(data)
      if (!parsed.success) {
        setLoadError('Os dados deste envio não puderam ser validados.')
        return
      }
      setSubmission(parsed.data)
      hasLoadedSubmission = true

      const signedResults = await Promise.all(
        parsed.data.attachments.map(async (attachment) => {
          const { data: signedData, error: signedError } = await client.storage
            .from('attachments')
            .createSignedUrl(attachment.storage_path, 300)
          if (signedError || !signedData) {
            throw new Error(
              'Não foi possível gerar os links temporários dos anexos.',
            )
          }
          return { ...attachment, signedUrl: signedData.signedUrl }
        }),
      )
      setAttachments(signedResults)
    } catch (error) {
      if (hasLoadedSubmission) {
        setAttachmentError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os anexos.',
        )
      } else {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o envio. Tente novamente.',
        )
      }
    } finally {
      setLoading(false)
    }
  }, [chapterId, client, sessionUserId, submissionId])

  useEffect(() => {
    if (!authLoading && profile?.status === 'approved' && profile.role === 'member') {
      const request = window.setTimeout(() => {
        void loadSubmission()
      }, 0)
      return () => window.clearTimeout(request)
    }
    return undefined
  }, [authLoading, loadSubmission, profile?.role, profile?.status])

  if (authLoading) {
    return (
      <main className="submission-page">
        <p role="status">Verificando sua conta…</p>
      </main>
    )
  }
  if (authError) {
    return (
      <main className="submission-page">
        <p className="submission-alert" role="alert">{authError}</p>
      </main>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (profile?.status !== 'approved') {
    return <Navigate to="/awaiting-approval" replace />
  }
  if (profile.role !== 'member') return <Navigate to="/" replace />

  return (
    <main className="submission-page">
      <section className="submission-content">
        <PageHeader />
        <nav className="submission-breadcrumb" aria-label="Navegação estrutural">
          <Link to="/my-submissions">Meus envios</Link>
          <span aria-hidden="true">/</span>
          <span>Detalhes</span>
        </nav>
        {loadError ? (
          <div className="submission-panel" role="alert">
            <p>{loadError}</p>
            <button
              className="submission-button submission-button--secondary"
              type="button"
              onClick={() => void loadSubmission()}
            >
              Tentar novamente
            </button>
          </div>
        ) : loading || !submission ? (
          <p className="submission-panel" role="status">
            Carregando envio…
          </p>
        ) : (
          <>
            <header className="submission-detail-heading">
              <div>
                <p className="submission-eyebrow">
                  {submission.activity.campaign?.name ?? 'Campanha estadual'}
                </p>
                <h1>{submission.activity.name}</h1>
                <p>Enviado em {formatDate(submission.created_at) ?? '—'}</p>
              </div>
              <SubmissionStatus status={submission.status} />
            </header>
            <section className="submission-panel">
              <div className="submission-section-title">
                <h2>Descrição enviada</h2>
                {submission.score !== null && (
                  <span className="submission-score">
                    {submission.score} / {submission.activity.points ?? '—'} pontos
                  </span>
                )}
              </div>
              <p className="submission-description">
                {submission.description || 'Nenhuma descrição informada.'}
              </p>
              {(submission.status === 'draft' ||
                submission.status === 'returned') && (
                <Link
                  className="submission-button submission-button--primary"
                  to={`/activities/${submission.activity_id}/submit`}
                >
                  {submission.status === 'returned'
                    ? 'Editar e reenviar'
                    : 'Continuar rascunho'}
                </Link>
              )}
            </section>

            <section className="submission-panel">
              <div className="submission-section-title">
                <h2>Anexos</h2>
                <span className="submission-muted">
                  {submission.attachments.length} de {MAX_ATTACHMENTS}
                </span>
              </div>
              {attachmentError && (
                <div className="submission-attachment-error" role="alert">
                  <p className="submission-form-error">{attachmentError}</p>
                  <button
                    className="submission-button submission-button--secondary"
                    type="button"
                    onClick={() => void loadSubmission()}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
              {attachments.map((attachment) => (
                <div className="submission-detail-attachment" key={attachment.id}>
                  {attachment.mime.startsWith('image/') ? (
                    <a
                      href={attachment.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="submission-image-preview"
                    >
                      <img src={attachment.signedUrl} alt="Anexo da atividade" />
                      <span>
                        {attachment.storage_path.split('/').at(-1)}
                      </span>
                    </a>
                  ) : (
                    <a
                      className="submission-pdf-link"
                      href={attachment.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="submission-file-icon">PDF</span>
                      <span>{attachment.storage_path.split('/').at(-1)}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              ))}
              {submission.attachments.length === 0 && (
                <p className="submission-muted">Nenhum anexo neste envio.</p>
              )}
            </section>

            <section className="submission-panel">
              <div className="submission-section-title">
                <h2>Comentários da avaliação</h2>
              </div>
              {submission.comments.length === 0 ? (
                <p className="submission-muted">
                  Nenhum comentário foi registrado.
                </p>
              ) : (
                <div className="submission-comments">
                  {submission.comments.map((comment) => (
                    <article className="submission-comment" key={comment.id}>
                      <header>
                        <strong>
                          {comment.author?.full_name ?? 'Equipe de avaliação'}
                        </strong>
                        <time dateTime={comment.created_at}>
                          {formatDateTime(comment.created_at)}
                        </time>
                      </header>
                      <p>{comment.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}

export { SubmissionFormPage, MySubmissionsPage, SubmissionDetailPage }
