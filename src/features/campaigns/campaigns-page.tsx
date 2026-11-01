import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/use-auth";
import emblem from "../../assets/brand/emblema-virtudes-atemporais.png";
import { SITE_NAME } from "../../config/site";
import { getLocalDateTimeParts, localDateTimeToIso } from "./activity-datetime";
import {
  activitySchema,
  campaignRecordSchema,
  campaignSchema,
  isCampaignOpen,
  type Activity,
  type ActivityFormValues,
  type Campaign,
  type CampaignFormValues,
} from "./campaign-schema";
import "./campaigns.css";

const campaignSelection =
  "id, name, starts_at, ends_at, active, activities(id, campaign_id, name, description, points, due_at, multiple_submissions)";

const activityHours = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const activityMinutes = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function formatDueAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function CampaignStatus({ campaign }: { campaign: Campaign }) {
  const today = new Date().toLocaleDateString("en-CA");
  const open = isCampaignOpen(campaign, today);
  const label = open
    ? "Em andamento"
    : campaign.active
      ? "Fora do período"
      : "Inativa";

  return (
    <span className={`campaign-status${open ? " campaign-status--open" : ""}`}>
      {label}
    </span>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const startsAt = formatDate(campaign.starts_at);
  const endsAt = formatDate(campaign.ends_at);

  return (
    <Link className="campaign-card" to={`/campaigns/${campaign.id}`}>
      <div className="campaign-card-top">
        <span className="campaign-card-icon" aria-hidden="true">
          C
        </span>
        <CampaignStatus campaign={campaign} />
      </div>
      <h2>{campaign.name}</h2>
      <p className="campaign-card-dates">
        {startsAt || endsAt
          ? `${startsAt ?? "Sem data inicial"} — ${endsAt ?? "Sem data final"}`
          : "Período não definido"}
      </p>
      <div className="campaign-card-bottom">
        <span>
          {campaign.activities.length}{" "}
          {campaign.activities.length === 1 ? "atividade" : "atividades"}
        </span>
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

function ActivityRow({
  activity,
  admin,
  member,
  onEdit,
  onDelete,
  busy,
}: {
  activity: Activity;
  admin: boolean;
  member: boolean;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
  busy: boolean;
}) {
  const dueAt = formatDueAt(activity.due_at);

  return (
    <article className="activity-row">
      <div className="activity-mark" aria-hidden="true">
        ✓
      </div>
      <div className="activity-content">
        <h3>{activity.name}</h3>
        {activity.description && <p>{activity.description}</p>}
        <div className="activity-meta">
          <span>{activity.points ?? 0} pontos</span>
          {dueAt && <span>Prazo: {dueAt}</span>}
          {activity.multiple_submissions && <span>Envios múltiplos</span>}
        </div>
      </div>
      {admin && (
        <div className="activity-admin-actions">
          <button
            type="button"
            className="campaign-text-button"
            onClick={() => onEdit?.(activity)}
            disabled={busy}
          >
            Editar
          </button>
          <button
            type="button"
            className="campaign-text-button campaign-text-button--danger"
            onClick={() => onDelete?.(activity)}
            disabled={busy}
          >
            Excluir
          </button>
        </div>
      )}
      {member && (
        <Link
          className="campaign-button campaign-button--secondary activity-submit-link"
          to={`/activities/${activity.id}/submit`}
        >
          Enviar atividade
        </Link>
      )}
    </article>
  );
}

function CampaignForm({
  campaign,
  saving,
  onSave,
  onCancel,
}: {
  campaign: Campaign | null;
  saving: boolean;
  onSave: (values: CampaignFormValues, id: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CampaignFormValues>({
    name: campaign?.name ?? "",
    startsAt: campaign?.starts_at ?? "",
    endsAt: campaign?.ends_at ?? "",
    active: campaign?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = campaignSchema.safeParse(values);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? "Revise os dados informados.",
      );
      return;
    }

    setError(null);
    await onSave(result.data, campaign?.id ?? null);
  };

  return (
    <form className="campaign-form" onSubmit={(event) => void submit(event)}>
      <h3>{campaign ? "Editar campanha" : "Nova campanha"}</h3>
      <label className="campaign-field campaign-field--wide">
        <span>Nome da campanha</span>
        <input
          required
          maxLength={160}
          value={values.name}
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
        />
      </label>
      <div className="campaign-form-row">
        <label className="campaign-field">
          <span>Início</span>
          <input
            type="date"
            value={values.startsAt}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                startsAt: event.target.value,
              }))
            }
          />
        </label>
        <label className="campaign-field">
          <span>Fim</span>
          <input
            type="date"
            value={values.endsAt}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                endsAt: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <label className="campaign-checkbox">
        <input
          type="checkbox"
          checked={values.active}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              active: event.target.checked,
            }))
          }
        />
        <span>Campanha ativa</span>
      </label>
      {error && (
        <p className="campaign-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="campaign-form-actions">
        <button
          className="campaign-button campaign-button--secondary"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          className="campaign-button campaign-button--primary"
          type="submit"
          disabled={saving}
        >
          {saving ? "Salvando…" : "Salvar campanha"}
        </button>
      </div>
    </form>
  );
}

function ActivityForm({
  campaignId,
  activity,
  saving,
  onSave,
  onCancel,
}: {
  campaignId: string;
  activity: Activity | null;
  saving: boolean;
  onSave: (values: ActivityFormValues, id: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const dueAt = getLocalDateTimeParts(activity?.due_at ?? null);
  const [values, setValues] = useState<ActivityFormValues>({
    campaignId,
    name: activity?.name ?? "",
    description: activity?.description ?? "",
    points: activity?.points ?? 0,
    dueAt: "",
    multipleSubmissions: activity?.multiple_submissions ?? false,
  });
  const [dueDate, setDueDate] = useState(dueAt.date);
  const [dueHour, setDueHour] = useState(dueAt.time.slice(0, 2));
  const [dueMinute, setDueMinute] = useState(dueAt.time.slice(3, 5));
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasDeadlineInput = Boolean(dueDate || dueHour || dueMinute);
    const hasCompleteDeadline = Boolean(dueDate && dueHour && dueMinute);
    if (hasDeadlineInput && !hasCompleteDeadline) {
      setError("Informe a data e o horário do prazo.");
      return;
    }

    let dueAt = "";
    if (dueDate && dueHour && dueMinute) {
      try {
        dueAt = localDateTimeToIso(dueDate, `${dueHour}:${dueMinute}`);
      } catch (validationError) {
        if (!(validationError instanceof RangeError)) throw validationError;
        setError(validationError.message);
        return;
      }
    }

    const result = activitySchema.safeParse({ ...values, dueAt });
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? "Revise os dados informados.",
      );
      return;
    }

    setError(null);
    await onSave(result.data, activity?.id ?? null);
  };

  return (
    <form className="campaign-form" onSubmit={(event) => void submit(event)}>
      <h3>{activity ? "Editar atividade" : "Nova atividade"}</h3>
      <label className="campaign-field campaign-field--wide">
        <span>Nome da atividade</span>
        <input
          required
          maxLength={160}
          value={values.name}
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
        />
      </label>
      <label className="campaign-field campaign-field--wide">
        <span>Descrição</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </label>
      <div className="campaign-form-row campaign-form-row--activity">
        <label className="campaign-field">
          <span>Pontos</span>
          <input
            type="number"
            min="0"
            max="10000"
            step="1"
            value={values.points}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                points:
                  event.target.value === "" ? 0 : Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="campaign-field">
          <span>Data do prazo</span>
          <input
            type="date"
            lang="pt-BR"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <label className="campaign-field">
          <span>Horário do prazo (24 horas)</span>
          <div className="campaign-time-fields">
            <select
              aria-label="Hora do prazo, formato 24 horas"
              value={dueHour}
              onChange={(event) => {
                const hour = event.target.value;
                setDueHour(hour);
                if (!hour) setDueMinute("");
                else if (!dueMinute) setDueMinute("00");
              }}
            >
              <option value="">Hora</option>
              {activityHours.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
            <select
              aria-label="Minuto do prazo"
              value={dueMinute}
              disabled={!dueHour}
              onChange={(event) => setDueMinute(event.target.value)}
            >
              <option value="">Minuto</option>
              {activityMinutes.map((minute) => (
                <option key={minute} value={minute}>
                  {minute}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>
      <label className="campaign-checkbox campaign-checkbox--multiple">
        <input
          type="checkbox"
          checked={values.multipleSubmissions}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              multipleSubmissions: event.target.checked,
            }))
          }
        />
        <span>
          <strong>Permitir múltiplos envios por capítulo</strong>
          <small>
            Cada capítulo poderá enviar a atividade quantas vezes quiser.
          </small>
        </span>
      </label>
      {error && (
        <p className="campaign-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="campaign-form-actions">
        <button
          className="campaign-button campaign-button--secondary"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          className="campaign-button campaign-button--primary"
          type="submit"
          disabled={saving}
        >
          {saving ? "Salvando…" : "Salvar atividade"}
        </button>
      </div>
    </form>
  );
}

export function CampaignsPage() {
  const { client, profile, loading: authLoading, error: authError } = useAuth();
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );
  const [activityForm, setActivityForm] = useState<{
    campaignId: string;
    activity: Activity | null;
  } | null>(null);

  const admin = profile?.role === "admin";
  const member = profile?.role === "member";
  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === campaignId,
  );
  const localNow = new Date();
  const today = [
    localNow.getFullYear(),
    String(localNow.getMonth() + 1).padStart(2, "0"),
    String(localNow.getDate()).padStart(2, "0"),
  ].join("-");

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await client
        .from("campaigns")
        .select(campaignSelection)
        .order("starts_at", { ascending: false, nullsFirst: false });

      if (error) {
        setLoadError(
          "Não foi possível carregar as campanhas. Tente novamente.",
        );
        return;
      }

      const parsedCampaigns = z.array(campaignRecordSchema).safeParse(data);
      if (!parsedCampaigns.success) {
        setLoadError("A lista de campanhas retornou dados inválidos.");
        return;
      }

      setCampaigns(parsedCampaigns.data);
    } catch {
      setLoadError("Não foi possível carregar as campanhas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!authLoading && !authError && profile?.status === "approved") {
      const request = window.setTimeout(() => {
        void loadCampaigns();
      }, 0);
      return () => window.clearTimeout(request);
    }
    return undefined;
  }, [authError, authLoading, loadCampaigns, profile?.status]);

  const openCampaigns = useMemo(
    () => campaigns.filter((campaign) => isCampaignOpen(campaign, today)),
    [campaigns, today],
  );

  const saveCampaign = async (
    values: CampaignFormValues,
    id: string | null,
  ) => {
    setSaving(true);
    setActionError(null);
    const payload = {
      name: values.name.trim(),
      starts_at: values.startsAt || null,
      ends_at: values.endsAt || null,
      active: values.active,
    };

    try {
      const result = id
        ? await client
            .from("campaigns")
            .update(payload)
            .eq("id", id)
            .select(campaignSelection)
            .maybeSingle()
        : await client
            .from("campaigns")
            .insert(payload)
            .select(campaignSelection)
            .single();

      if (result.error) {
        setActionError("Não foi possível salvar a campanha. Tente novamente.");
        return;
      }

      const parsedCampaign = campaignRecordSchema.safeParse(result.data);
      if (!parsedCampaign.success) {
        setActionError(
          "A resposta ao salvar a campanha não pôde ser validada.",
        );
        return;
      }

      setCampaigns((current) => {
        const remaining = current.filter((campaign) => campaign.id !== id);
        return [...remaining, parsedCampaign.data];
      });
      setCampaignFormOpen(false);
      setEditingCampaignId(null);
    } catch {
      setActionError("Não foi possível salvar a campanha. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (campaign: Campaign) => {
    if (
      !window.confirm(
        `Excluir a campanha "${campaign.name}"? A exclusão só será possível se não houver atividades ou envios associados.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const { error } = await client
        .from("campaigns")
        .delete()
        .eq("id", campaign.id);

      if (error) {
        setActionError(
          "Não foi possível excluir a campanha. Ela pode ter atividades ou envios associados.",
        );
        return;
      }

      setCampaigns((current) =>
        current.filter((item) => item.id !== campaign.id),
      );
      if (campaignId === campaign.id) {
        navigate("/campaigns", { replace: true });
      }
    } catch {
      setActionError("Não foi possível excluir a campanha. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const saveActivity = async (
    values: ActivityFormValues,
    id: string | null,
  ) => {
    setSaving(true);
    setActionError(null);
    const dueAt = values.dueAt ? new Date(values.dueAt).toISOString() : null;
    const payload = {
      campaign_id: values.campaignId,
      name: values.name.trim(),
      description: values.description.trim() || null,
      points: values.points,
      due_at: dueAt,
      multiple_submissions: values.multipleSubmissions,
    };

    try {
      const result = id
        ? await client
            .from("activities")
            .update(payload)
            .eq("id", id)
            .select(
              "id, campaign_id, name, description, points, due_at, multiple_submissions",
            )
            .single()
        : await client
            .from("activities")
            .insert(payload)
            .select(
              "id, campaign_id, name, description, points, due_at, multiple_submissions",
            )
            .single();

      if (result.error) {
        setActionError(
          result.error.message.includes("não é possível desativar a opção")
            ? "Não é possível desativar envios múltiplos porque já existem vários envios para algum capítulo nesta atividade."
            : "Não foi possível salvar a atividade. Tente novamente.",
        );
        return;
      }

      const parsedActivity = activitySchemaForRecord.safeParse(result.data);
      if (!parsedActivity.success) {
        setActionError(
          "A resposta ao salvar a atividade não pôde ser validada.",
        );
        return;
      }

      setCampaigns((current) =>
        current.map((campaign) => {
          if (campaign.id !== payload.campaign_id) return campaign;
          const activities = campaign.activities.filter(
            (activity) => activity.id !== id,
          );
          return {
            ...campaign,
            activities: [...activities, parsedActivity.data],
          };
        }),
      );
      setActivityForm(null);
    } catch {
      setActionError("Não foi possível salvar a atividade. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const deleteActivity = async (activity: Activity) => {
    if (!window.confirm(`Excluir a atividade "${activity.name}"?`)) {
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const { error } = await client
        .from("activities")
        .delete()
        .eq("id", activity.id);

      if (error) {
        setActionError(
          "Não foi possível excluir a atividade. Ela pode ter envios associados.",
        );
        return;
      }

      setCampaigns((current) =>
        current.map((item) => ({
          ...item,
          activities: item.activities.filter(
            (currentActivity) => currentActivity.id !== activity.id,
          ),
        })),
      );
    } catch {
      setActionError("Não foi possível excluir a atividade. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <main
        className={`campaign-page${member ? " campaign-page--member" : " campaign-page--admin"}`}
      >
        <p role="status">Verificando sua conta…</p>
      </main>
    );
  }
  if (authError) {
    return (
      <main className="campaign-page">
        <div className="campaign-alert" role="alert">
          {authError}
        </div>
      </main>
    );
  }
  if (!profile || profile.status !== "approved") {
    return <Navigate to="/awaiting-approval" replace />;
  }

  const visibleCampaigns = admin ? campaigns : openCampaigns;
  const displayedCampaign = selectedCampaign;
  if (
    displayedCampaign &&
    !admin &&
    !isCampaignOpen(displayedCampaign, today)
  ) {
    return <Navigate to="/campaigns" replace />;
  }
  const editableCampaign =
    campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null;

  return (
    <main className="campaign-page">
      <section className="campaign-content">
        <header className="campaign-header">
          <Link className="campaign-brand" to="/">
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
          <div className="campaign-header-actions">
            {admin && (
              <Link className="campaign-admin-link" to="/admin/users">
                Usuários
              </Link>
            )}
            {member && (
              <Link className="campaign-admin-link" to="/my-submissions">
                Meus envios
              </Link>
            )}
            <Link className="campaign-admin-link" to="/">
              Minha conta
            </Link>
          </div>
        </header>

        {displayedCampaign ? (
          <>
            <nav
              className="campaign-breadcrumb"
              aria-label="Navegação estrutural"
            >
              <Link to="/campaigns">Campanhas</Link>
              <span aria-hidden="true">/</span>
              <span>{displayedCampaign.name}</span>
            </nav>
            <div className="campaign-detail-heading">
              <div>
                <p className="campaign-eyebrow">
                  {admin ? "Gestão de campanhas" : "Campanha estadual"}
                </p>
                <h1>{displayedCampaign.name}</h1>
                <p className="campaign-period">
                  {formatDate(displayedCampaign.starts_at) ??
                    "Sem data inicial"}
                  {" — "}
                  {formatDate(displayedCampaign.ends_at) ?? "Sem data final"}
                </p>
              </div>
              <CampaignStatus campaign={displayedCampaign} />
            </div>
            {admin && (
              <div className="campaign-toolbar">
                <button
                  className="campaign-button campaign-button--secondary"
                  type="button"
                  onClick={() => {
                    setEditingCampaignId(displayedCampaign.id);
                    setCampaignFormOpen(true);
                  }}
                  disabled={saving}
                >
                  Editar campanha
                </button>
                <button
                  className="campaign-button campaign-button--danger"
                  type="button"
                  onClick={() => void deleteCampaign(displayedCampaign)}
                  disabled={saving}
                >
                  Excluir campanha
                </button>
              </div>
            )}
            {campaignFormOpen && admin && (
              <CampaignForm
                key={editingCampaignId ?? "new"}
                campaign={editableCampaign}
                saving={saving}
                onSave={saveCampaign}
                onCancel={() => {
                  setCampaignFormOpen(false);
                  setEditingCampaignId(null);
                }}
              />
            )}
            <section
              className="campaign-activities"
              aria-labelledby="activities-title"
            >
              <div className="campaign-section-heading">
                <div>
                  <p className="campaign-eyebrow">Participe</p>
                  <h2 id="activities-title">Atividades</h2>
                </div>
                <span className="activity-total">
                  {displayedCampaign.activities.length}{" "}
                  {displayedCampaign.activities.length === 1
                    ? "atividade"
                    : "atividades"}
                </span>
              </div>
              {admin && (
                <div className="campaign-toolbar campaign-toolbar--activity">
                  <button
                    className="campaign-button campaign-button--primary"
                    type="button"
                    onClick={() =>
                      setActivityForm({
                        campaignId: displayedCampaign.id,
                        activity: null,
                      })
                    }
                    disabled={saving}
                  >
                    Nova atividade
                  </button>
                </div>
              )}
              {activityForm?.campaignId === displayedCampaign.id && admin && (
                <ActivityForm
                  key={activityForm.activity?.id ?? "new-activity"}
                  campaignId={displayedCampaign.id}
                  activity={activityForm.activity}
                  saving={saving}
                  onSave={saveActivity}
                  onCancel={() => setActivityForm(null)}
                />
              )}
              {actionError && (
                <p className="campaign-alert" role="alert">
                  {actionError}
                </p>
              )}
              {displayedCampaign.activities.length === 0 ? (
                <div className="campaign-empty campaign-empty--compact">
                  <p>Nenhuma atividade foi publicada nesta campanha.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {displayedCampaign.activities.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      admin={admin}
                      member={member}
                      busy={saving}
                      onEdit={(item) =>
                        setActivityForm({
                          campaignId: displayedCampaign.id,
                          activity: item,
                        })
                      }
                      onDelete={(item) => void deleteActivity(item)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="campaign-list-heading">
              <div>
                <p className="campaign-eyebrow">
                  {admin ? "Gestão de campanhas" : "Acompanhe seu capítulo"}
                </p>
                <h1>Campanhas</h1>
                <p>
                  {admin
                    ? "Crie e organize as campanhas e atividades estaduais."
                    : "Confira as campanhas em andamento e as atividades disponíveis."}
                </p>
              </div>
              {admin && (
                <button
                  className="campaign-button campaign-button--primary"
                  type="button"
                  onClick={() => {
                    setEditingCampaignId(null);
                    setCampaignFormOpen(true);
                  }}
                  disabled={saving}
                >
                  Nova campanha
                </button>
              )}
            </div>

            {campaignFormOpen && admin && (
              <CampaignForm
                key={editingCampaignId ?? "new"}
                campaign={editableCampaign}
                saving={saving}
                onSave={saveCampaign}
                onCancel={() => {
                  setCampaignFormOpen(false);
                  setEditingCampaignId(null);
                }}
              />
            )}

            {actionError && (
              <p className="campaign-alert" role="alert">
                {actionError}
              </p>
            )}
            {loadError ? (
              <div className="campaign-empty" role="alert">
                <p>{loadError}</p>
                <button
                  className="campaign-button campaign-button--secondary"
                  type="button"
                  onClick={() => void loadCampaigns()}
                >
                  Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <p className="campaign-empty" role="status">
                Carregando campanhas…
              </p>
            ) : visibleCampaigns.length === 0 ? (
              <div className="campaign-empty">
                <span className="campaign-empty-icon" aria-hidden="true">
                  C
                </span>
                <h2>
                  {admin
                    ? "Nenhuma campanha cadastrada"
                    : "Nenhuma campanha em andamento"}
                </h2>
                <p>
                  {admin
                    ? "Crie a primeira campanha para organizar as atividades estaduais."
                    : "As campanhas disponíveis para participação aparecerão aqui."}
                </p>
              </div>
            ) : (
              <div className="campaign-grid">
                {visibleCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

const activitySchemaForRecord = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  points: z.number().int().nullable(),
  due_at: z.string().nullable(),
  multiple_submissions: z.boolean(),
});
