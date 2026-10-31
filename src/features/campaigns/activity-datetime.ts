function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function getLocalDateTimeParts(value: string | null) {
  if (!value) return { date: '', time: '' }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError('O prazo salvo contém uma data inválida.')
  }

  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  }
}

export function localDateTimeToIso(date: string, time: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new RangeError('Informe uma data e horário válidos.')
  }

  const parsed = new Date(`${date}T${time}:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError('Informe uma data e horário válidos.')
  }

  const roundTrip = getLocalDateTimeParts(parsed.toISOString())
  if (roundTrip.date !== date || roundTrip.time !== time) {
    throw new RangeError('Esse horário não existe na data informada.')
  }

  return parsed.toISOString()
}
